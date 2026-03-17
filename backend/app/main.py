from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.api.routes.health import router as health_router
from app.api.routes.processing import router as processing_router
from app.api.routes.tasks import router as tasks_router
from app.config import settings

# Sentry initialization
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=0.1,
        environment="production" if not settings.DEBUG else "development",
    )

# Rate limiter
limiter = Limiter(key_func=get_remote_address, default_limits=[settings.RATE_LIMIT])


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"Starting {settings.APP_NAME}...")
    yield
    print(f"Shutting down {settings.APP_NAME}...")


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS - explicit origins and methods
allowed_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
)


# API key verification middleware
@app.middleware("http")
async def verify_api_key(request: Request, call_next):
    # Skip API key check for health and docs endpoints
    path = request.url.path
    if path.startswith("/health") or path.startswith("/docs") or path.startswith("/redoc") or path.startswith("/openapi"):
        return await call_next(request)

    api_key = request.headers.get("X-API-Key")
    if api_key != settings.API_KEY:
        return Response(content='{"error":"Invalid API key"}', status_code=401, media_type="application/json")

    return await call_next(request)


app.include_router(health_router, prefix="/health", tags=["health"])
app.include_router(processing_router, prefix="/process", tags=["processing"])
app.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
