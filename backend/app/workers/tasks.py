from celery import current_task

from app.workers.celery_app import celery_app


def update_progress(progress: int, stage: str):
    current_task.update_state(
        state="PROGRESS",
        meta={"progress": progress, "stage": stage},
    )


@celery_app.task(bind=True)
def process_full_conversion(self, job_id: str, image_url: str, crop_region: dict | None = None):
    """Full facade to DXF conversion pipeline."""
    from app.pipeline.orchestrator import run_full_pipeline

    return run_full_pipeline(
        job_id=job_id,
        image_url=image_url,
        crop_region=crop_region,
        progress_callback=update_progress,
    )


@celery_app.task(bind=True)
def process_partial_split(self, job_id: str, image_url: str, split_config: dict):
    """Split facade and process each part."""
    from app.pipeline.orchestrator import run_split_pipeline

    return run_split_pipeline(
        job_id=job_id,
        image_url=image_url,
        split_config=split_config,
        progress_callback=update_progress,
    )


@celery_app.task(bind=True)
def process_detail_extraction(self, job_id: str, image_url: str, detail_region: dict):
    """Extract detail area and generate DXF."""
    from app.pipeline.orchestrator import run_detail_pipeline

    return run_detail_pipeline(
        job_id=job_id,
        image_url=image_url,
        detail_region=detail_region,
        progress_callback=update_progress,
    )


@celery_app.task(bind=True)
def process_auto_coding(self, job_id: str, dxf_url: str, image_url: str, image_height: int):
    """Add automatic dimension coding to existing DXF."""
    from app.pipeline.orchestrator import run_auto_coding_pipeline

    return run_auto_coding_pipeline(
        job_id=job_id,
        dxf_url=dxf_url,
        image_url=image_url,
        image_height=image_height,
        progress_callback=update_progress,
    )


@celery_app.task(bind=True)
def process_manual_coding(self, job_id: str, dxf_url: str, coding_config: dict, image_height: int):
    """Apply manual coding configuration to existing DXF."""
    from app.pipeline.orchestrator import run_manual_coding_pipeline

    return run_manual_coding_pipeline(
        job_id=job_id,
        dxf_url=dxf_url,
        coding_config=coding_config,
        image_height=image_height,
        progress_callback=update_progress,
    )
