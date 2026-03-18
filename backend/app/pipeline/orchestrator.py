"""Pipeline Orchestrator

Chains pipeline stages and manages progress reporting.
Uses edge-tracing approach: image → edges → vectors → DXF.
"""

import time
from datetime import datetime, timezone
from typing import Callable

import numpy as np

from app.config import settings
from app.core.storage import download_file, upload_bytes
from app.pipeline.auto_coder import generate_auto_coding
from app.pipeline.detector import facade_detector
from app.pipeline.dxf_builder import build_dxf_from_traces, generate_preview
from app.pipeline.manual_coder import apply_manual_coding
from app.pipeline.preprocessor import (
    crop_region as crop_region_fn,
    image_to_bytes,
    load_image_from_bytes,
    preprocess_image,
    split_image,
)
from app.pipeline.regularizer import regularize_traces


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

    # Stage 1: Preprocessing
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

    # Stage 2: Edge tracing
    report(20, "tracing_edges")
    lines, contours, detect_meta = facade_detector.trace_edges(image)

    # Stage 3: Geometric regularization (merge duplicates, snap to grid)
    report(45, "regularizing")
    lines, contours = regularize_traces(lines, contours, w, h)
    report(50, "tracing_complete")

    # Stage 3: Build DXF from traced edges
    report(60, "generating_dxf")
    dxf_bytes = build_dxf_from_traces(lines, contours, w, h)

    # Generate preview
    report(80, "generating_preview")
    preview_bytes = generate_preview(dxf_bytes)

    # Upload results
    report(90, "uploading_results")
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

    # Collect layer info
    layers = set()
    for l in lines:
        layers.add(l.layer)
    for c in contours:
        layers.add(c.layer)

    return {
        "dxf_url": dxf_url,
        "preview_url": preview_url,
        "meta": {
            "image_width": w,
            "image_height": h,
            "elements_count": len(lines) + len(contours),
            "layers": list(layers),
            "processing_time_seconds": round(processing_time, 2),
            "floor_ys": detect_meta["floor_ys"],
            "column_xs": detect_meta["column_xs"],
            "window_rects": detect_meta["window_rects"],
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
        trace_lines, trace_contours, _ = facade_detector.trace_edges(sub_img)
        dxf_bytes = build_dxf_from_traces(trace_lines, trace_contours, w, h)

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
    detail = preprocess_image(detail, max_size=settings.MAX_IMAGE_SIZE)
    h, w = detail.shape[:2]

    report(25, "tracing_edges")
    trace_lines, trace_contours, _ = facade_detector.trace_edges(detail)

    report(60, "generating_dxf")
    dxf_bytes = build_dxf_from_traces(trace_lines, trace_contours, w, h)

    preview_bytes = generate_preview(dxf_bytes)

    report(90, "uploading")
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

    report(0, "downloading_dxf")
    bucket, key = _parse_s3_url(dxf_url)
    dxf_bytes = download_file(bucket, key)

    report(10, "downloading_image")
    img_bucket, img_key = _parse_s3_url(image_url)
    image_data = download_file(img_bucket, img_key)
    image = load_image_from_bytes(image_data)
    image = preprocess_image(image)
    h, w = image.shape[:2]

    # Detect structure for placing dimension axes
    report(20, "tracing_edges")
    trace_lines, trace_contours, _ = facade_detector.trace_edges(image)
    trace_lines, trace_contours = regularize_traces(trace_lines, trace_contours, w, h)

    report(75, "generating_coding")
    coding_config = generate_auto_coding(trace_lines, trace_contours, w, h)

    report(85, "applying_coding")
    coded_bytes = apply_manual_coding(dxf_bytes, coding_config, image_height)

    report(90, "generating_preview")
    preview_bytes = generate_preview(coded_bytes)

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
    parts = url.split("/")
    if len(parts) >= 5:
        bucket = parts[3]
        key = "/".join(parts[4:])
        return bucket, key
    raise ValueError(f"Invalid S3 URL: {url}")
