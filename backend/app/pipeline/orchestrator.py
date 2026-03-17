"""Pipeline Orchestrator

Chains all 6 pipeline stages and manages progress reporting.
"""

import time
from datetime import datetime, timezone
from typing import Callable

from app.config import settings
from app.core.storage import download_file, upload_bytes
from app.pipeline.auto_coder import generate_auto_coding
from app.pipeline.detector import facade_detector
from app.pipeline.dxf_builder import add_dimensions_to_dxf, build_dxf, generate_preview
from app.pipeline.manual_coder import apply_manual_coding
from app.pipeline.preprocessor import (
    crop_region as crop_region_fn,
    image_to_bytes,
    load_image_from_bytes,
    preprocess_image,
    split_image,
)
from app.pipeline.regularizer import regularize_elements
from app.pipeline.segmentor import facade_segmentor
from app.pipeline.vectorizer import vectorize_elements


def run_full_pipeline(
    job_id: str,
    image_url: str,
    crop_region: dict | None = None,
    progress_callback: Callable | None = None,
) -> dict:
    """Run the complete facade-to-DXF conversion pipeline."""
    start_time = time.time()

    def report(progress: int, stage: str):
        if progress_callback:
            progress_callback(progress, stage)

    # Stage 1: Preprocessing (0-15%)
    report(0, "downloading_image")
    bucket, key = _parse_s3_url(image_url)
    image_data = download_file(bucket, key)
    image = load_image_from_bytes(image_data)

    if crop_region:
        image = crop_region_fn(image, crop_region)

    report(5, "preprocessing")
    image = preprocess_image(image)
    h, w = image.shape[:2]
    report(15, "preprocessing_complete")

    # Stage 2: Detection (15-35%)
    report(20, "detecting_elements")
    detections = facade_detector.detect_facades(image)
    report(35, "detection_complete")

    # Stage 3: Segmentation (35-55%)
    report(40, "segmenting_elements")
    segments = facade_segmentor.segment(image, detections)
    report(55, "segmentation_complete")

    # Stage 4: Vectorization (55-75%)
    report(60, "vectorizing")
    elements = vectorize_elements(image, segments)
    report(75, "vectorization_complete")

    # Stage 5: Regularization (75-85%)
    report(78, "regularizing")
    elements = regularize_elements(elements, (h, w))
    report(85, "regularization_complete")

    # Stage 6: DXF Generation (85-95%)
    report(88, "generating_dxf")
    dxf_bytes = build_dxf(elements, w, h)

    # Generate preview
    report(92, "generating_preview")
    preview_bytes = generate_preview(dxf_bytes)

    # Upload results
    report(95, "uploading_results")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    dxf_url = upload_bytes(
        settings.S3_BUCKET_RESULTS,
        f"{job_id}/{timestamp}_facade.dxf",
        dxf_bytes,
        "application/dxf",
    )

    preview_url = ""
    if preview_bytes:
        preview_url = upload_bytes(
            settings.S3_BUCKET_RESULTS,
            f"{job_id}/{timestamp}_preview.png",
            preview_bytes,
            "image/png",
        )

    processing_time = time.time() - start_time
    report(100, "complete")

    return {
        "dxf_url": dxf_url,
        "preview_url": preview_url,
        "meta": {
            "image_width": w,
            "image_height": h,
            "elements_count": len(elements),
            "layers": list(set(e.class_name for e in elements)),
            "processing_time_seconds": round(processing_time, 2),
        },
    }


def run_split_pipeline(
    job_id: str,
    image_url: str,
    split_config: dict,
    progress_callback: Callable | None = None,
) -> dict:
    """Split facade and process each part separately."""

    def report(progress: int, stage: str):
        if progress_callback:
            progress_callback(progress, stage)

    report(0, "downloading_image")
    bucket, key = _parse_s3_url(image_url)
    image_data = download_file(bucket, key)
    image = load_image_from_bytes(image_data)
    image = preprocess_image(image)

    direction = split_config.get("direction", "horizontal")
    parts = split_config.get("parts", 2)
    parts = max(2, min(parts, 4))

    report(10, "splitting_image")
    sub_images = split_image(image, direction, parts)

    results = []
    for i, sub_img in enumerate(sub_images):
        base_progress = 10 + (i * 80 // len(sub_images))
        report(base_progress, f"processing_part_{i + 1}")

        h, w = sub_img.shape[:2]
        detections = facade_detector.detect_facades(sub_img)
        segments = facade_segmentor.segment(sub_img, detections)
        elements = vectorize_elements(sub_img, segments)
        elements = regularize_elements(elements, (h, w))
        dxf_bytes = build_dxf(elements, w, h)

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        dxf_url = upload_bytes(
            settings.S3_BUCKET_RESULTS,
            f"{job_id}/part_{i + 1}_{timestamp}.dxf",
            dxf_bytes,
            "application/dxf",
        )
        results.append({"part": i + 1, "dxf_url": dxf_url})

    report(100, "complete")
    return {"parts": results, "total_parts": len(sub_images)}


def run_detail_pipeline(
    job_id: str,
    image_url: str,
    detail_region: dict,
    progress_callback: Callable | None = None,
) -> dict:
    """Extract and process a detail area at higher resolution."""

    def report(progress: int, stage: str):
        if progress_callback:
            progress_callback(progress, stage)

    report(0, "downloading_image")
    bucket, key = _parse_s3_url(image_url)
    image_data = download_file(bucket, key)
    image = load_image_from_bytes(image_data)

    report(10, "cropping_detail")
    detail = crop_region_fn(image, detail_region)
    # Don't resize down for detail - keep high resolution
    detail = preprocess_image(detail, max_size=settings.MAX_IMAGE_SIZE)
    h, w = detail.shape[:2]

    report(25, "detecting_elements")
    detections = facade_detector.detect_facades(detail)

    report(45, "segmenting")
    segments = facade_segmentor.segment(detail, detections)

    report(60, "vectorizing")
    elements = vectorize_elements(detail, segments)

    report(75, "regularizing")
    elements = regularize_elements(elements, (h, w))

    report(85, "generating_dxf")
    dxf_bytes = build_dxf(elements, w, h)

    preview_bytes = generate_preview(dxf_bytes)

    report(95, "uploading")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    dxf_url = upload_bytes(
        settings.S3_BUCKET_RESULTS,
        f"{job_id}/detail_{timestamp}.dxf",
        dxf_bytes,
        "application/dxf",
    )

    preview_url = ""
    if preview_bytes:
        preview_url = upload_bytes(
            settings.S3_BUCKET_RESULTS,
            f"{job_id}/detail_preview_{timestamp}.png",
            preview_bytes,
            "image/png",
        )

    report(100, "complete")
    return {"dxf_url": dxf_url, "preview_url": preview_url}


def run_auto_coding_pipeline(
    job_id: str,
    dxf_url: str,
    image_url: str,
    image_height: int,
    progress_callback: Callable | None = None,
) -> dict:
    """Add automatic dimension coding to an existing DXF."""

    def report(progress: int, stage: str):
        if progress_callback:
            progress_callback(progress, stage)

    # Download existing DXF
    report(0, "downloading_dxf")
    bucket, key = _parse_s3_url(dxf_url)
    dxf_bytes = download_file(bucket, key)

    # Download and analyze original image for element detection
    report(10, "downloading_image")
    img_bucket, img_key = _parse_s3_url(image_url)
    image_data = download_file(img_bucket, img_key)
    image = load_image_from_bytes(image_data)
    image = preprocess_image(image)
    h, w = image.shape[:2]

    report(20, "detecting_elements")
    detections = facade_detector.detect_facades(image)

    report(40, "segmenting_elements")
    segments = facade_segmentor.segment(image, detections)

    report(55, "vectorizing")
    elements = vectorize_elements(image, segments)

    report(65, "regularizing")
    elements = regularize_elements(elements, (h, w))

    # Generate auto coding config from detected elements
    report(75, "generating_coding")
    coding_config = generate_auto_coding(elements, w, h)

    # Apply coding to DXF
    report(85, "applying_coding")
    coded_bytes = apply_manual_coding(dxf_bytes, coding_config, image_height)

    # Generate preview
    report(90, "generating_preview")
    preview_bytes = generate_preview(coded_bytes)

    # Upload results
    report(95, "uploading")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    coded_url = upload_bytes(
        settings.S3_BUCKET_RESULTS,
        f"{job_id}/coded_{timestamp}.dxf",
        coded_bytes,
        "application/dxf",
    )

    preview_url = ""
    if preview_bytes:
        preview_url = upload_bytes(
            settings.S3_BUCKET_RESULTS,
            f"{job_id}/coded_preview_{timestamp}.png",
            preview_bytes,
            "image/png",
        )

    report(100, "complete")
    return {"dxf_url": coded_url, "preview_url": preview_url}


def run_manual_coding_pipeline(
    job_id: str,
    dxf_url: str,
    coding_config: dict,
    image_height: int,
    progress_callback: Callable | None = None,
) -> dict:
    """Apply user-placed manual coding to an existing DXF."""

    def report(progress: int, stage: str):
        if progress_callback:
            progress_callback(progress, stage)

    report(0, "downloading_dxf")
    bucket, key = _parse_s3_url(dxf_url)
    dxf_bytes = download_file(bucket, key)

    report(30, "applying_coding")
    coded_bytes = apply_manual_coding(dxf_bytes, coding_config, image_height)

    report(60, "generating_preview")
    preview_bytes = generate_preview(coded_bytes)

    report(80, "uploading")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    coded_url = upload_bytes(
        settings.S3_BUCKET_RESULTS,
        f"{job_id}/coded_{timestamp}.dxf",
        coded_bytes,
        "application/dxf",
    )

    preview_url = ""
    if preview_bytes:
        preview_url = upload_bytes(
            settings.S3_BUCKET_RESULTS,
            f"{job_id}/coded_preview_{timestamp}.png",
            preview_bytes,
            "image/png",
        )

    report(100, "complete")
    return {"dxf_url": coded_url, "preview_url": preview_url}


def _parse_s3_url(url: str) -> tuple[str, str]:
    """Parse S3 URL into bucket and key."""
    # Format: http://endpoint/bucket/key
    parts = url.split("/")
    # Find bucket (first path segment after host)
    # URL format: http://localhost:9000/bucket/path/to/file
    if len(parts) >= 5:
        bucket = parts[3]
        key = "/".join(parts[4:])
        return bucket, key
    raise ValueError(f"Invalid S3 URL: {url}")
