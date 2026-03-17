from typing import Any

from pydantic import BaseModel


class FullConversionRequest(BaseModel):
    job_id: str
    image_url: str
    crop_region: dict[str, float] | None = None


class PartialSplitRequest(BaseModel):
    job_id: str
    image_url: str
    split_config: dict[str, Any]


class DetailExtractionRequest(BaseModel):
    job_id: str
    image_url: str
    detail_region: dict[str, float]


class AutoCodingRequest(BaseModel):
    job_id: str
    dxf_url: str
    image_url: str
    image_height: int


class ManualCodingRequest(BaseModel):
    job_id: str
    dxf_url: str
    coding_config: dict[str, Any]
    image_height: int


class ProcessingResponse(BaseModel):
    task_id: str
    status: str
