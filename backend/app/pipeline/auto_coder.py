"""Auto Coding: AI-based automatic dimension and level coding.

Detects floor lines and element dimensions, then adds
measurement annotations to the DXF.
"""

import numpy as np

from app.pipeline.vectorizer import VectorElement


def generate_auto_coding(
    elements: list[VectorElement],
    image_width: int,
    image_height: int,
    reference_height: float | None = None,
) -> dict:
    """Generate automatic coding configuration from detected elements.

    Args:
        elements: Vectorized facade elements
        image_width: Image width in pixels
        image_height: Image height in pixels
        reference_height: Known real-world height in meters (e.g., door height = 2.1m)

    Returns:
        Coding configuration dict with axes and text annotations.
    """
    # Calculate pixel-to-meter scale if reference provided
    scale = _calculate_scale(elements, reference_height) if reference_height else 1.0

    # Detect floor levels
    floor_lines = [e for e in elements if e.class_name == "floor_line"]
    floor_y_positions = sorted(
        [(e.points[0][1] + e.points[1][1]) / 2 for e in floor_lines]
    )

    # Generate outer axes (horizontal floor lines)
    outer_axes = []
    for i, y in enumerate(floor_y_positions):
        # Calculate level relative to ground (bottom floor line)
        if floor_y_positions:
            height_from_ground = (floor_y_positions[-1] - y) * scale
        else:
            height_from_ground = 0

        outer_axes.append({
            "y": y,
            "label": f"+{height_from_ground:.2f}" if height_from_ground > 0 else "±0.00",
        })

    # Generate inner axes (vertical, at column/window positions)
    inner_axes = _generate_inner_axes(elements, image_width)

    # Generate dimension texts
    texts = _generate_dimension_texts(elements, floor_y_positions, scale, image_height)

    return {
        "innerAxes": inner_axes[:30],  # Max 30
        "outerAxes": outer_axes[:10],  # Max 10
        "texts": texts,
        "scale": scale,
    }


def _calculate_scale(elements: list[VectorElement], reference_height: float) -> float:
    """Calculate pixel-to-meter scale from a reference element (typically a door)."""
    doors = [e for e in elements if e.class_name == "door" and e.element_type == "rectangle"]
    if not doors:
        # Try windows as fallback (standard window height ~1.2m)
        windows = [e for e in elements if e.class_name == "window" and e.element_type == "rectangle"]
        if windows:
            heights = []
            for w in windows:
                ys = [p[1] for p in w.points]
                heights.append(max(ys) - min(ys))
            avg_height_px = np.mean(heights)
            return 1.2 / avg_height_px  # Assume 1.2m window height
        return 1.0 / 100  # Default: 1 pixel = 1cm

    # Use door height as reference
    heights = []
    for door in doors:
        ys = [p[1] for p in door.points]
        heights.append(max(ys) - min(ys))

    avg_door_height_px = np.mean(heights)
    return reference_height / avg_door_height_px


def _generate_inner_axes(elements: list[VectorElement], image_width: int) -> list[dict]:
    """Generate vertical axis lines at significant positions."""
    # Collect x-positions of all elements
    x_positions = []

    for e in elements:
        if e.class_name in ("window", "door", "column"):
            xs = [p[0] for p in e.points]
            x_positions.append(min(xs))  # Left edge
            x_positions.append(max(xs))  # Right edge

    if not x_positions:
        return []

    # Cluster nearby positions
    x_positions = sorted(set(round(x / 5) * 5 for x in x_positions))

    # Merge positions within 10px
    merged = [x_positions[0]]
    for x in x_positions[1:]:
        if x - merged[-1] > 10:
            merged.append(x)

    # Generate labels (A, B, C, ...)
    axes = []
    for i, x in enumerate(merged):
        label = chr(65 + (i % 26))  # A-Z
        if i >= 26:
            label = chr(65 + (i // 26 - 1)) + chr(65 + (i % 26))  # AA, AB, ...
        axes.append({"x": x, "label": label})

    return axes


def _generate_dimension_texts(
    elements: list[VectorElement],
    floor_y_positions: list[float],
    scale: float,
    image_height: int,
) -> list[dict]:
    """Generate dimension text annotations."""
    texts = []

    # Floor-to-floor heights
    for i in range(len(floor_y_positions) - 1):
        y1 = floor_y_positions[i]
        y2 = floor_y_positions[i + 1]
        height = abs(y2 - y1) * scale
        mid_y = (y1 + y2) / 2

        texts.append({
            "x": -120,
            "y": mid_y,
            "value": f"{height:.2f}m",
            "fontSize": 10,
        })

    # Window/door dimensions
    for e in elements:
        if e.class_name not in ("window", "door"):
            continue
        if e.element_type != "rectangle" or len(e.points) < 4:
            continue

        xs = [p[0] for p in e.points]
        ys = [p[1] for p in e.points]
        w = (max(xs) - min(xs)) * scale
        h = (max(ys) - min(ys)) * scale
        center_x = (min(xs) + max(xs)) / 2
        center_y = (min(ys) + max(ys)) / 2

        texts.append({
            "x": center_x,
            "y": center_y,
            "value": f"{w:.1f}x{h:.1f}",
            "fontSize": 8,
        })

    return texts
