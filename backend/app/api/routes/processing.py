from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import verify_api_key
from app.schemas.processing import (
    AutoCodingRequest,
    DetailExtractionRequest,
    FullConversionRequest,
    ManualCodingRequest,
    PartialSplitRequest,
    ProcessingResponse,
)
from app.workers.tasks import (
    process_auto_coding,
    process_detail_extraction,
    process_full_conversion,
    process_manual_coding,
    process_partial_split,
)

router = APIRouter(dependencies=[Depends(verify_api_key)])


@router.post("/full-conversion", response_model=ProcessingResponse)
async def full_conversion(request: FullConversionRequest):
    task = process_full_conversion.delay(
        job_id=request.job_id,
        image_url=request.image_url,
        crop_region=request.crop_region,
    )
    return ProcessingResponse(task_id=task.id, status="queued")


@router.post("/partial-split", response_model=ProcessingResponse)
async def partial_split(request: PartialSplitRequest):
    task = process_partial_split.delay(
        job_id=request.job_id,
        image_url=request.image_url,
        split_config=request.split_config,
    )
    return ProcessingResponse(task_id=task.id, status="queued")


@router.post("/detail-extraction", response_model=ProcessingResponse)
async def detail_extraction(request: DetailExtractionRequest):
    task = process_detail_extraction.delay(
        job_id=request.job_id,
        image_url=request.image_url,
        detail_region=request.detail_region,
    )
    return ProcessingResponse(task_id=task.id, status="queued")


@router.post("/auto-coding", response_model=ProcessingResponse)
async def auto_coding(request: AutoCodingRequest):
    task = process_auto_coding.delay(
        job_id=request.job_id,
        dxf_url=request.dxf_url,
        image_url=request.image_url,
        image_height=request.image_height,
    )
    return ProcessingResponse(task_id=task.id, status="queued")


@router.post("/manual-coding", response_model=ProcessingResponse)
async def manual_coding(request: ManualCodingRequest):
    task = process_manual_coding.delay(
        job_id=request.job_id,
        dxf_url=request.dxf_url,
        coding_config=request.coding_config,
        image_height=request.image_height,
    )
    return ProcessingResponse(task_id=task.id, status="queued")
