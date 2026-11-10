import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

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
    # Nạp bản chụp danh mục vật tư lần đầu (đồng bộ) rồi mới chạy vòng quét nền.
    try:
        await asyncio.get_running_loop().run_in_executor(None, product_index_service.refresh)
    except Exception as e:
        logger.warning(f"Initial product index load failed: {e}")
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
    allow_methods=["GET", "POST", "OPTIONS"],
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

@app.get("/", tags=["Health"])
def root():
    return {
        "success": True,
        "app": settings.APP_NAME,
        "phase": "Giai đoạn 1 (Read-Only)",
        "version": "1.0.0",
        "docs_url": "/docs"
    }

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
