"""Stage 1: Image Preprocessing

- Perspective correction via vanishing point detection
- Resolution management (8K max)
- CLAHE contrast enhancement
"""

import cv2
import numpy as np
from PIL import Image

from app.config import settings


def preprocess_image(image: np.ndarray, max_size: int | None = None) -> np.ndarray:
    """Run full preprocessing pipeline on input image."""
    if max_size is None:
        max_size = settings.MAX_IMAGE_SIZE

    image = resize_to_max(image, max_size)
    image = correct_perspective(image)
    image = enhance_contrast(image)
    return image


def resize_to_max(image: np.ndarray, max_size: int) -> np.ndarray:
    """Scale image so longest edge is at most max_size pixels."""
    h, w = image.shape[:2]
    if max(h, w) <= max_size:
        return image

    scale = max_size / max(h, w)
    new_w = int(w * scale)
    new_h = int(h * scale)
    return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)


def correct_perspective(image: np.ndarray) -> np.ndarray:
    """Attempt perspective correction using vanishing point detection.

    Uses Hough lines to find dominant vertical and horizontal lines,
    then applies homography to rectify the facade to a frontal view.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)

    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=100, minLineLength=100, maxLineGap=10)
    if lines is None or len(lines) < 4:
        return image  # Not enough lines to determine perspective

    # Separate lines into vertical and horizontal groups
    vertical_lines = []
    horizontal_lines = []

    for line in lines:
        x1, y1, x2, y2 = line[0]
        angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
        if abs(angle) > 70:  # Near vertical
            vertical_lines.append(line[0])
        elif abs(angle) < 20:  # Near horizontal
            horizontal_lines.append(line[0])

    if len(vertical_lines) < 2 or len(horizontal_lines) < 2:
        return image  # Can't determine perspective with too few lines

    # Check if correction is needed: measure average deviation from true vertical
    avg_deviation = np.mean([
        abs(90 - abs(np.degrees(np.arctan2(y2 - y1, x2 - x1))))
        for x1, y1, x2, y2 in vertical_lines
    ])

    if avg_deviation < 2.0:  # Already nearly rectified
        return image

    # Find corner points from extreme line intersections
    h, w = image.shape[:2]
    src_points = _find_facade_corners(vertical_lines, horizontal_lines, w, h)
    if src_points is None:
        return image

    dst_points = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    matrix = cv2.getPerspectiveTransform(src_points, dst_points)
    corrected = cv2.warpPerspective(image, matrix, (w, h))
    return corrected


def _find_facade_corners(
    vertical_lines: list, horizontal_lines: list, width: int, height: int
) -> np.ndarray | None:
    """Find the four corners of the facade from detected lines."""
    # Use the leftmost, rightmost verticals and topmost, bottommost horizontals
    v_sorted = sorted(vertical_lines, key=lambda l: (l[0] + l[2]) / 2)
    h_sorted = sorted(horizontal_lines, key=lambda l: (l[1] + l[3]) / 2)

    if len(v_sorted) < 2 or len(h_sorted) < 2:
        return None

    left_line = v_sorted[0]
    right_line = v_sorted[-1]
    top_line = h_sorted[0]
    bottom_line = h_sorted[-1]

    corners = []
    for v_line in [left_line, right_line]:
        for h_line in [top_line, bottom_line]:
            pt = _line_intersection(v_line, h_line)
            if pt is not None:
                corners.append(pt)

    if len(corners) != 4:
        return None

    # Order: top-left, top-right, bottom-right, bottom-left
    corners.sort(key=lambda p: (p[1], p[0]))
    top = sorted(corners[:2], key=lambda p: p[0])
    bottom = sorted(corners[2:], key=lambda p: p[0])
    ordered = np.float32([top[0], top[1], bottom[1], bottom[0]])

    # Sanity check: corners should be within reasonable bounds
    for pt in ordered:
        if pt[0] < -width * 0.1 or pt[0] > width * 1.1:
            return None
        if pt[1] < -height * 0.1 or pt[1] > height * 1.1:
            return None

    return ordered


def _line_intersection(line1: np.ndarray, line2: np.ndarray) -> tuple[float, float] | None:
    """Find intersection point of two line segments."""
    x1, y1, x2, y2 = line1
    x3, y3, x4, y4 = line2

    denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(denom) < 1e-10:
        return None

    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
    px = x1 + t * (x2 - x1)
    py = y1 + t * (y2 - y1)
    return (px, py)


def enhance_contrast(image: np.ndarray) -> np.ndarray:
    """Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)."""
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_enhanced = clahe.apply(l_channel)

    enhanced = cv2.merge([l_enhanced, a_channel, b_channel])
    return cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)


def crop_region(image: np.ndarray, region: dict[str, float]) -> np.ndarray:
    """Crop image to specified region {x, y, width, height} in relative coordinates (0-1)."""
    h, w = image.shape[:2]
    x = int(region["x"] * w)
    y = int(region["y"] * h)
    cw = int(region["width"] * w)
    ch = int(region["height"] * h)

    x = max(0, min(x, w - 1))
    y = max(0, min(y, h - 1))
    cw = min(cw, w - x)
    ch = min(ch, h - y)

    return image[y : y + ch, x : x + cw]


def split_image(image: np.ndarray, direction: str, parts: int) -> list[np.ndarray]:
    """Split image into parts along specified direction."""
    h, w = image.shape[:2]
    splits = []

    if direction == "horizontal":
        part_w = w // parts
        for i in range(parts):
            x_start = i * part_w
            x_end = w if i == parts - 1 else (i + 1) * part_w
            splits.append(image[:, x_start:x_end])
    elif direction == "vertical":
        part_h = h // parts
        for i in range(parts):
            y_start = i * part_h
            y_end = h if i == parts - 1 else (i + 1) * part_h
            splits.append(image[y_start:y_end, :])

    return splits


def load_image_from_bytes(data: bytes) -> np.ndarray:
    """Load image from byte data."""
    nparr = np.frombuffer(data, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Failed to decode image data")
    return image


def image_to_bytes(image: np.ndarray, format: str = ".png") -> bytes:
    """Convert image to bytes."""
    success, buffer = cv2.imencode(format, image)
    if not success:
        raise ValueError(f"Failed to encode image as {format}")
    return buffer.tobytes()
