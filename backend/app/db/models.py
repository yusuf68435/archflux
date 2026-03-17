"""SQLAlchemy models mirroring the Prisma schema.

Used by FastAPI/Celery workers to update job status and progress directly.
"""

import enum

from sqlalchemy import DateTime, Enum, Float, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class JobStatus(str, enum.Enum):
    PENDING = "PENDING"
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class JobType(str, enum.Enum):
    FULL_CONVERSION = "FULL_CONVERSION"
    PARTIAL_SPLIT = "PARTIAL_SPLIT"
    DETAIL_EXTRACTION = "DETAIL_EXTRACTION"
    AUTO_CODING = "AUTO_CODING"


class Job(Base):
    __tablename__ = "Job"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[JobType] = mapped_column(Enum(JobType), nullable=False)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.PENDING)
    creditsCost: Mapped[int] = mapped_column(Integer, nullable=False)

    inputImageUrl: Mapped[str] = mapped_column(String, nullable=False)
    inputImageMeta: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    cropRegion: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    splitConfig: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    detailRegion: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    codingConfig: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    outputDxfUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    outputPreviewUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    outputMeta: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    celeryTaskId: Mapped[str | None] = mapped_column(String, nullable=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    errorMessage: Mapped[str | None] = mapped_column(Text, nullable=True)

    startedAt: Mapped[str | None] = mapped_column(DateTime, nullable=True)
    completedAt: Mapped[str | None] = mapped_column(DateTime, nullable=True)
    createdAt: Mapped[str] = mapped_column(DateTime, server_default=func.now())
    updatedAt: Mapped[str] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
