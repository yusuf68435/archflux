"""Stage 4: Edge Extraction and Vectorization

Converts pixel masks into vector polylines and geometric primitives.
"""

from dataclasses import dataclass

import cv2
import numpy as np

from app.pipeline.detector import Detection


@dataclass
class VectorElement:
    class_name: str
    element_type: str  # "rectangle", "polyline", "line"
    points: list[tuple[float, float]]  # List of (x, y) coordinates
    bbox: tuple[float, float, float, float]
    confidence: float


def vectorize_elements(
    image: np.ndarray,
    segmentation_results: list[dict],
) -> list[VectorElement]:
    """Convert segmented masks into vector elements."""
    elements = []

    for seg_result in segmentation_results:
        detection: Detection = seg_result["detection"]
        mask: np.ndarray = seg_result["mask"]

        # Convert mask to uint8 if needed
        if mask.dtype != np.uint8:
            mask = (mask * 255).astype(np.uint8)

        # Determine vectorization strategy based on element type
        if detection.class_name in ("window", "door", "shutter"):
            element = _vectorize_rectangular(mask, detection)
        else:
            element = _vectorize_polyline(mask, detection)

        if element is not None:
            elements.append(element)

    # Also extract overall facade outline and major lines
    outline = _extract_facade_outline(image)
    if outline is not None:
        elements.append(outline)

    floor_lines = _detect_floor_lines(image)
    elements.extend(floor_lines)

    return elements


def _vectorize_rectangular(mask: np.ndarray, detection: Detection) -> VectorElement | None:
    """Vectorize rectangular elements (windows, doors) as fitted rectangles."""
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    # Take largest contour
    contour = max(contours, key=cv2.contourArea)
    if cv2.contourArea(contour) < 100:
        return None

    # Fit minimum area rectangle
    rect = cv2.minAreaRect(contour)
    box = cv2.boxPoints(rect)
    points = [(float(p[0]), float(p[1])) for p in box]

    return VectorElement(
        class_name=detection.class_name,
        element_type="rectangle",
        points=points,
        bbox=detection.bbox,
        confidence=detection.confidence,
    )


def _vectorize_polyline(mask: np.ndarray, detection: Detection) -> VectorElement | None:
    """Vectorize irregular elements as simplified polylines."""
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    contour = max(contours, key=cv2.contourArea)
    if cv2.contourArea(contour) < 100:
        return None

    # Simplify contour using Douglas-Peucker
    perimeter = cv2.arcLength(contour, True)
    epsilon = 0.02 * perimeter  # 2% of perimeter
    simplified = cv2.approxPolyDP(contour, epsilon, True)

    points = [(float(p[0][0]), float(p[0][1])) for p in simplified]

    return VectorElement(
        class_name=detection.class_name,
        element_type="polyline",
        points=points,
        bbox=detection.bbox,
        confidence=detection.confidence,
    )


def _extract_facade_outline(image: np.ndarray) -> VectorElement | None:
    """Extract the overall facade/building outline."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 30, 100)

    # Dilate edges to connect nearby segments
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges = cv2.dilate(edges, kernel, iterations=2)
    edges = cv2.erode(edges, kernel, iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    # Find the largest contour (likely the facade outline)
    largest = max(contours, key=cv2.contourArea)
    h, w = image.shape[:2]
    if cv2.contourArea(largest) < (h * w * 0.1):
        return None

    perimeter = cv2.arcLength(largest, True)
    simplified = cv2.approxPolyDP(largest, 0.01 * perimeter, True)
    points = [(float(p[0][0]), float(p[0][1])) for p in simplified]

    return VectorElement(
        class_name="wall_outline",
        element_type="polyline",
        points=points,
        bbox=(0, 0, float(w), float(h)),
        confidence=1.0,
    )


def _detect_floor_lines(image: np.ndarray) -> list[VectorElement]:
    """Detect horizontal floor lines using Hough transform."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)

    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=150, minLineLength=200, maxLineGap=30)
    if lines is None:
        return []

    h, w = image.shape[:2]
    floor_lines = []

    for line in lines:
        x1, y1, x2, y2 = line[0]
        angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))

        # Only near-horizontal lines
        if abs(angle) > 5:
            continue

        # Must span at least 40% of image width
        line_length = abs(x2 - x1)
        if line_length < w * 0.4:
            continue

        floor_lines.append(
            VectorElement(
                class_name="floor_line",
                element_type="line",
                points=[(float(x1), float(y1)), (float(x2), float(y2))],
                bbox=(float(min(x1, x2)), float(min(y1, y2)), float(max(x1, x2)), float(max(y1, y2))),
                confidence=0.8,
            )
        )

    # Merge nearby floor lines (within 10px vertical distance)
    floor_lines = _merge_horizontal_lines(floor_lines, threshold=10)

    return floor_lines


def _merge_horizontal_lines(lines: list[VectorElement], threshold: float = 10) -> list[VectorElement]:
    """Merge floor lines that are close together vertically."""
    if len(lines) <= 1:
        return lines

    sorted_lines = sorted(lines, key=lambda l: (l.points[0][1] + l.points[1][1]) / 2)
    merged = [sorted_lines[0]]

    for line in sorted_lines[1:]:
        prev_y = (merged[-1].points[0][1] + merged[-1].points[1][1]) / 2
        curr_y = (line.points[0][1] + line.points[1][1]) / 2

        if abs(curr_y - prev_y) < threshold:
            # Merge: extend the previous line
            all_x = [p[0] for p in merged[-1].points + line.points]
            avg_y = (prev_y + curr_y) / 2
            merged[-1] = VectorElement(
                class_name="floor_line",
                element_type="line",
                points=[(min(all_x), avg_y), (max(all_x), avg_y)],
                bbox=merged[-1].bbox,
                confidence=max(merged[-1].confidence, line.confidence),
            )
        else:
            merged.append(line)

    return merged
