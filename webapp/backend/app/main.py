import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import test_db_connection
from app.routers import lookups, vouchers, pickup, debt, print as print_router
from app.routers import prices, products
from app.services.product_index_service import product_index_service, REFRESH_INTERVAL

logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("app.main")


async def _product_index_loop():
    """Quét nền danh mục vật tư để phát hiện thay đổi (chạy trong thread executor)."""
    loop = asyncio.get_running_loop()
    while True:
        try:
            await loop.run_in_executor(None, product_index_service.refresh)
        except Exception as e:  # pragma: no cover - phòng hờ
            logger.warning(f"Product index refresh failed: {e}")
        await asyncio.sleep(REFRESH_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Chạy ngầm việc nạp và đồng bộ danh mục vật tư để mở cổng 8000 ngay lập tức.
    task = asyncio.create_task(_product_index_loop())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Web App Quản lý Chứng từ Bán hàng 1S (Giai đoạn 1 - Read-Only)",
    lifespan=lifespan,
)

# Nén phản hồi (đặc biệt hữu ích cho /api/products/changes trả toàn bộ danh mục).
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS Middleware
# NOTE: allow_credentials=True is incompatible with allow_origins=["*"] per the
# CORS spec. We therefore never send the wildcard when credentials are allowed.
origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS]
origins = [o for o in origins if o and o != "*"] or ["http://localhost:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(lookups.router)
app.include_router(vouchers.router)
app.include_router(pickup.router)
app.include_router(debt.router)
app.include_router(print_router.router)
app.include_router(prices.router)
app.include_router(products.router)

def _app_info_payload():
    return {
        "success": True,
        "app": settings.APP_NAME,
        "phase": "Giai đoạn 1 (Read-Only)",
        "version": "1.0.0",
        "docs_url": "/docs",
    }


@app.get("/api/info", tags=["Health"])
def app_info():
    return _app_info_payload()


@app.get("/api/health", tags=["Health"])
def health_check():
    """
    Health check endpoint verifying server status and database connectivity.
    """
    vp_conn = test_db_connection(settings.DB_VP)
    kh_conn = test_db_connection(settings.DB_KH)
    sys_conn = test_db_connection(settings.DB_SYS)

    return {
        "success": True,
        "status": "healthy",
        "databases": {
            "VP_2014": vp_conn,
            "KH_2014": kh_conn,
            "VTSYS": sys_conn
        }
    }


# Serve built Frontend SPA (production single-port deployment)
_FRONTEND_DIST_DIR = (Path(__file__).resolve().parent.parent.parent / "frontend" / "dist").resolve()
_FRONTEND_INDEX = _FRONTEND_DIST_DIR / "index.html"

if _FRONTEND_INDEX.is_file():
    _assets_dir = _FRONTEND_DIST_DIR / "assets"
    if _assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="frontend-assets")

    @app.get("/", include_in_schema=False)
    def serve_spa_root():
        return FileResponse(_FRONTEND_INDEX)

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa_fallback(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        if full_path:
            candidate = (_FRONTEND_DIST_DIR / full_path).resolve()
            if candidate.is_relative_to(_FRONTEND_DIST_DIR) and candidate.is_file():
                return FileResponse(candidate)
        return FileResponse(_FRONTEND_INDEX)
else:
    @app.get("/", tags=["Health"])
    def root():
        return _app_info_payload()
