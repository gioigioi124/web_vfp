import asyncio
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

try:
    import orjson

    class FastJSONResponse(Response):
        media_type = "application/json"

        def render(self, content) -> bytes:
            return orjson.dumps(
                content,
                option=orjson.OPT_NON_STR_KEYS | orjson.OPT_SERIALIZE_NUMPY,
            )

    _DefaultResponseClass = FastJSONResponse
except Exception:  # pragma: no cover
    _DefaultResponseClass = JSONResponse

from app.config import settings
from app.database import close_all_pools, test_db_connection
from app.routers import lookups, vouchers, pickup, debt, print as print_router
from app.routers import prices, products, customers, cash_vouchers, price_lists, general_modules
from app.services.product_index_service import product_index_service, REFRESH_INTERVAL
from app.services.customer_index_service import (
    customer_index_service,
    REFRESH_INTERVAL as CUSTOMER_REFRESH_INTERVAL,
)

logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("app.main")


class ImmutableStaticFiles(StaticFiles):
    """StaticFiles for Vite hashed assets with long-lived immutable browser cache."""

    async def get_response(self, path: str, scope):
        resp = await super().get_response(path, scope)
        if resp.status_code == 200:
            resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return resp


async def _product_index_loop():
    """Quét nền danh mục vật tư để phát hiện thay đổi (chạy trong thread executor)."""
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, product_index_service.load_disk_cache)
    except Exception as e:  # pragma: no cover
        logger.warning(f"Product index disk cache load failed: {e}")

    while True:
        try:
            await loop.run_in_executor(None, product_index_service.refresh)
        except Exception as e:  # pragma: no cover - phòng hờ
            logger.warning(f"Product index refresh failed: {e}")
        await asyncio.sleep(REFRESH_INTERVAL)


async def _customer_index_loop():
    """Quét nền danh mục khách hàng để phát hiện thay đổi (chạy trong thread executor)."""
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, customer_index_service.load_disk_cache)
    except Exception as e:  # pragma: no cover
        logger.warning(f"Customer index disk cache load failed: {e}")

    while True:
        try:
            await loop.run_in_executor(None, customer_index_service.refresh)
        except Exception as e:  # pragma: no cover - phòng hờ
            logger.warning(f"Customer index refresh failed: {e}")
        await asyncio.sleep(CUSTOMER_REFRESH_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Chạy ngầm việc nạp và đồng bộ danh mục vật tư + khách hàng để mở cổng 8000 ngay lập tức.
    product_task = asyncio.create_task(_product_index_loop())
    customer_task = asyncio.create_task(_customer_index_loop())
    try:
        yield
    finally:
        product_task.cancel()
        customer_task.cancel()
        close_all_pools()


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Web App Quản lý Chứng từ Bán hàng 1S",
    default_response_class=_DefaultResponseClass,
    lifespan=lifespan,
)


@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    response.headers["X-Process-Time"] = f"{elapsed_ms:.1f}ms"
    if elapsed_ms >= 500.0 and request.url.path.startswith("/api/"):
        logger.warning(
            f"Slow API {request.method} {request.url.path} ({elapsed_ms:.1f}ms, status={response.status_code})"
        )
    return response


# Nén phản hồi với compresslevel=5 (~4.3x nhanh hơn level=9, tránh treo asyncio event loop).
app.add_middleware(GZipMiddleware, minimum_size=1000, compresslevel=5)

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
app.include_router(customers.router)
app.include_router(cash_vouchers.router)
app.include_router(price_lists.router)
app.include_router(general_modules.router)


def _app_info_payload():
    return {
        "success": True,
        "app": settings.APP_NAME,
        "phase": "Production",
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
        app.mount("/assets", ImmutableStaticFiles(directory=str(_assets_dir)), name="frontend-assets")

    @app.get("/", include_in_schema=False)
    def serve_spa_root():
        return FileResponse(_FRONTEND_INDEX, headers={"Cache-Control": "no-cache"})

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa_fallback(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        if full_path:
            candidate = (_FRONTEND_DIST_DIR / full_path).resolve()
            if candidate.is_relative_to(_FRONTEND_DIST_DIR) and candidate.is_file():
                return FileResponse(candidate, headers={"Cache-Control": "public, max-age=3600"})
        return FileResponse(_FRONTEND_INDEX, headers={"Cache-Control": "no-cache"})
else:
    @app.get("/", tags=["Health"])
    def root():
        return _app_info_payload()
