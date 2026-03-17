"""Singleton model loader for AI models.

Loads YOLO and SAM models once and keeps them in memory.
"""

from app.pipeline.detector import facade_detector
from app.pipeline.segmentor import facade_segmentor


def load_all_models():
    """Load all AI models into memory. Call during application startup."""
    print("Loading YOLO model...")
    facade_detector.load()
    print("YOLO model loaded.")

    print("Loading SAM model...")
    facade_segmentor.load()
    print("SAM model loaded.")

    print("All models loaded successfully.")
