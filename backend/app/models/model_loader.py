"""Model loader — no-op for the classical CV pipeline.

The projection-based detector requires no ML models.
SAM / YOLO integration is reserved for future versions.
"""

from app.pipeline.detector import facade_detector


def load_all_models():
    """Initialize pipeline components. Called during application startup."""
    facade_detector.load()
    print("Pipeline initialized (classical CV — no model weights required).")
