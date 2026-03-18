"""VectorElement type definition (legacy compatibility).

The vectorization stage has been replaced by the projection-based detector.
This module is kept only for backward compatibility with auto_coder.py.
"""

from dataclasses import dataclass, field


@dataclass
class VectorElement:
    class_name: str
    element_type: str          # "rectangle" | "line" | "polyline"
    points: list[tuple[float, float]]
    bbox: tuple[float, float, float, float]
    confidence: float = 1.0
    metadata: dict = field(default_factory=dict)
