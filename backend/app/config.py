from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "ArchFlux AI Service"
    DEBUG: bool = False
    API_KEY: str = "change-me-in-production"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://rolix:rolix@localhost:5432/rolix"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # S3 / MinIO
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET_UPLOADS: str = "uploads"
    S3_BUCKET_RESULTS: str = "results"
    S3_REGION: str = "us-east-1"
    S3_PUBLIC_URL: str = ""  # Public base URL for file access (e.g. https://domain.com)

    # AI Models
    YOLO_WEIGHTS: str = "yolov8x.pt"
    SAM_CHECKPOINT: str = "sam2_hiera_large.pt"
    CONFIDENCE_THRESHOLD: float = 0.5
    DEVICE: str = "cuda"  # "cuda" or "cpu"

    # Processing
    MAX_IMAGE_SIZE: int = 8192  # 8K max
    MAX_UPLOAD_SIZE_MB: int = 100

    # Security
    ALLOWED_ORIGINS: str = "http://localhost:3000"  # comma-separated
    RATE_LIMIT: str = "60/minute"
    SENTRY_DSN: str = ""

    model_config = {"env_file": ".env", "case_sensitive": True}


settings = Settings()
