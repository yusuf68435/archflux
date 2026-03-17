import torch
from fastapi import APIRouter

from app.workers.celery_app import celery_app
from app.core.storage import get_s3_client
from app.config import settings

router = APIRouter()


@router.get("/")
async def health_check():
    return {
        "status": "healthy",
        "service": "archflux-ai",
        "version": "1.0.0",
    }


@router.get("/gpu")
async def gpu_check():
    cuda_available = torch.cuda.is_available()
    gpu_info = None
    if cuda_available:
        gpu_info = {
            "device_count": torch.cuda.device_count(),
            "device_name": torch.cuda.get_device_name(0),
            "memory_allocated": f"{torch.cuda.memory_allocated(0) / 1024**2:.0f}MB",
            "memory_total": f"{torch.cuda.get_device_properties(0).total_mem / 1024**2:.0f}MB",
        }
    return {
        "cuda_available": cuda_available,
        "gpu_info": gpu_info,
        "device": "cuda" if cuda_available else "cpu",
    }


@router.get("/celery")
async def celery_check():
    try:
        inspector = celery_app.control.inspect()
        active = inspector.active()
        if active is None:
            return {"status": "unhealthy", "workers": 0}
        return {"status": "ok", "workers": len(active)}
    except Exception:
        return {"status": "unhealthy", "workers": 0}


@router.get("/minio")
async def minio_check():
    try:
        client = get_s3_client()
        client.head_bucket(Bucket=settings.S3_BUCKET_UPLOADS)
        return {"status": "ok"}
    except Exception:
        return {"status": "unhealthy"}
