from celery.result import AsyncResult
from fastapi import APIRouter, Depends

from app.api.deps import verify_api_key
from app.workers.celery_app import celery_app

router = APIRouter(dependencies=[Depends(verify_api_key)])


@router.get("/{task_id}")
async def get_task_status(task_id: str):
    result = AsyncResult(task_id, app=celery_app)
    response = {
        "task_id": task_id,
        "status": result.status,
    }

    if result.status == "PROGRESS":
        response["progress"] = result.info.get("progress", 0)
        response["stage"] = result.info.get("stage", "")
    elif result.status == "SUCCESS":
        response["result"] = result.result
        response["progress"] = 100
    elif result.status == "FAILURE":
        response["error"] = str(result.result)
        response["progress"] = 0

    return response
