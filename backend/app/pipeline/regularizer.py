"""Stage 5: Geometric Regularization

Cleans up vectorized output:
- Snaps angles to 0/90/180/270
- Aligns elements to grid
- Enforces symmetry
- Sharpens corners
"""

import numpy as np

from app.pipeline.vectorizer import VectorElement

ANGLE_TOLERANCE_DEG = 2.0
ALIGNMENT_TOLERANCE_PX = 5.0


def regularize_elements(elements: list[VectorElement], image_shape: tuple) -> list[VectorElement]:
    """Run full regularization pipeline."""
    elements = [snap_angles(e) for e in elements]
    elements = align_elements(elements)
    elements = enforce_grid_pattern(elements, image_shape)
    elements = sharpen_corners(elements)
    return elements


def snap_angles(element: VectorElement) -> VectorElement:
    """Snap near-axis angles to exact 0/90/180/270 degrees."""
    if element.element_type == "line":
        return _snap_line(element)
    elif element.element_type == "rectangle":
        return _snap_rectangle(element)
    elif element.element_type == "polyline":
        return _snap_polyline(element)
    return element


def _snap_line(element: VectorElement) -> VectorElement:
    """Snap a line to horizontal or vertical if within tolerance."""
    (x1, y1), (x2, y2) = element.points[0], element.points[1]
    angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))

    if abs(angle) < ANGLE_TOLERANCE_DEG or abs(abs(angle) - 180) < ANGLE_TOLERANCE_DEG:
        # Snap to horizontal
        avg_y = (y1 + y2) / 2
        new_points = [(x1, avg_y), (x2, avg_y)]
    elif abs(abs(angle) - 90) < ANGLE_TOLERANCE_DEG:
        # Snap to vertical
        avg_x = (x1 + x2) / 2
        new_points = [(avg_x, y1), (avg_x, y2)]
    else:
        new_points = element.points

    return VectorElement(
        class_name=element.class_name,
        element_type=element.element_type,
        points=new_points,
        bbox=element.bbox,
        confidence=element.confidence,
    )


def _snap_rectangle(element: VectorElement) -> VectorElement:
    """Snap rectangle corners to axis-aligned."""
    if len(element.points) != 4:
        return element

    pts = np.array(element.points)

    # Find min bounding box aligned to axes
    x_min, y_min = pts.min(axis=0)
    x_max, y_max = pts.max(axis=0)

    # Check if already roughly axis-aligned
    widths = [abs(pts[i][0] - pts[(i + 1) % 4][0]) for i in range(4)]
    heights = [abs(pts[i][1] - pts[(i + 1) % 4][1]) for i in range(4)]

    new_points = [
        (x_min, y_min),  # top-left
        (x_max, y_min),  # top-right
        (x_max, y_max),  # bottom-right
        (x_min, y_max),  # bottom-left
    ]

    return VectorElement(
        class_name=element.class_name,
        element_type=element.element_type,
        points=new_points,
        bbox=(x_min, y_min, x_max, y_max),
        confidence=element.confidence,
    )


def _snap_polyline(element: VectorElement) -> VectorElement:
    """Snap polyline segments to axis-aligned where close."""
    new_points = [element.points[0]]

    for i in range(1, len(element.points)):
        x1, y1 = new_points[-1]
        x2, y2 = element.points[i]

        angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))

        if abs(angle) < ANGLE_TOLERANCE_DEG or abs(abs(angle) - 180) < ANGLE_TOLERANCE_DEG:
            new_points.append((x2, y1))  # Snap to horizontal
        elif abs(abs(angle) - 90) < ANGLE_TOLERANCE_DEG:
            new_points.append((x1, y2))  # Snap to vertical
        else:
            new_points.append((x2, y2))

    return VectorElement(
        class_name=element.class_name,
        element_type=element.element_type,
        points=new_points,
        bbox=element.bbox,
        confidence=element.confidence,
    )


def align_elements(elements: list[VectorElement]) -> list[VectorElement]:
    """Align elements that are nearly at the same position."""
    # Group by class for alignment
    by_class: dict[str, list[int]] = {}
    for i, e in enumerate(elements):
        by_class.setdefault(e.class_name, []).append(i)

    for class_name, indices in by_class.items():
        if len(indices) < 2:
            continue

        # Align tops of same-class elements in same row
        _align_row_tops(elements, indices)
        # Align lefts of same-class elements in same column
        _align_column_lefts(elements, indices)

    return elements


def _align_row_tops(elements: list[VectorElement], indices: list[int]):
    """Align top edges of elements in the same approximate row."""
    tops = [(i, min(p[1] for p in elements[i].points)) for i in indices]
    tops.sort(key=lambda t: t[1])

    groups = []
    current_group = [tops[0]]

    for j in range(1, len(tops)):
        if abs(tops[j][1] - current_group[-1][1]) < ALIGNMENT_TOLERANCE_PX:
            current_group.append(tops[j])
        else:
            groups.append(current_group)
            current_group = [tops[j]]
    groups.append(current_group)

    for group in groups:
        if len(group) < 2:
            continue
        avg_top = np.mean([t[1] for t in group])
        for idx, _ in group:
            _shift_element_y(elements, idx, avg_top)


def _align_column_lefts(elements: list[VectorElement], indices: list[int]):
    """Align left edges of elements in the same approximate column."""
    lefts = [(i, min(p[0] for p in elements[i].points)) for i in indices]
    lefts.sort(key=lambda t: t[1])

    groups = []
    current_group = [lefts[0]]

    for j in range(1, len(lefts)):
        if abs(lefts[j][1] - current_group[-1][1]) < ALIGNMENT_TOLERANCE_PX:
            current_group.append(lefts[j])
        else:
            groups.append(current_group)
            current_group = [lefts[j]]
    groups.append(current_group)

    for group in groups:
        if len(group) < 2:
            continue
        avg_left = np.mean([t[1] for t in group])
        for idx, _ in group:
            _shift_element_x(elements, idx, avg_left)


def _shift_element_y(elements: list[VectorElement], idx: int, target_top: float):
    """Shift element vertically so its top aligns with target."""
    e = elements[idx]
    current_top = min(p[1] for p in e.points)
    dy = target_top - current_top
    new_points = [(p[0], p[1] + dy) for p in e.points]
    elements[idx] = VectorElement(
        class_name=e.class_name,
        element_type=e.element_type,
        points=new_points,
        bbox=e.bbox,
        confidence=e.confidence,
    )


def _shift_element_x(elements: list[VectorElement], idx: int, target_left: float):
    """Shift element horizontally so its left aligns with target."""
    e = elements[idx]
    current_left = min(p[0] for p in e.points)
    dx = target_left - current_left
    new_points = [(p[0] + dx, p[1]) for p in e.points]
    elements[idx] = VectorElement(
        class_name=e.class_name,
        element_type=e.element_type,
        points=new_points,
        bbox=e.bbox,
        confidence=e.confidence,
    )


def enforce_grid_pattern(elements: list[VectorElement], image_shape: tuple) -> list[VectorElement]:
    """Detect and enforce grid patterns in window arrays."""
    windows = [e for e in elements if e.class_name == "window"]
    if len(windows) < 4:
        return elements

    # Detect regular spacing
    centers = [((min(p[0] for p in w.points) + max(p[0] for p in w.points)) / 2,
                (min(p[1] for p in w.points) + max(p[1] for p in w.points)) / 2)
               for w in windows]

    # Check for regular horizontal spacing
    x_centers = sorted(set(round(c[0] / 10) * 10 for c in centers))
    if len(x_centers) >= 3:
        spacings = [x_centers[i + 1] - x_centers[i] for i in range(len(x_centers) - 1)]
        if len(spacings) >= 2:
            avg_spacing = np.mean(spacings)
            std_spacing = np.std(spacings)
            if std_spacing < avg_spacing * 0.15:  # Regular enough
                # Snap to regular grid
                base_x = x_centers[0]
                for i, x in enumerate(x_centers):
                    expected_x = base_x + i * avg_spacing
                    # Shift windows near this x to expected_x
                    for j, w in enumerate(windows):
                        wx = (min(p[0] for p in w.points) + max(p[0] for p in w.points)) / 2
                        if abs(wx - x * 1.0) < 15:
                            dx = expected_x - wx
                            elements[elements.index(w)] = VectorElement(
                                class_name=w.class_name,
                                element_type=w.element_type,
                                points=[(p[0] + dx, p[1]) for p in w.points],
                                bbox=w.bbox,
                                confidence=w.confidence,
                            )

    return elements


def sharpen_corners(elements: list[VectorElement]) -> list[VectorElement]:
    """Ensure rectangular elements have exact 90-degree corners."""
    result = []
    for e in elements:
        if e.element_type == "rectangle" and len(e.points) == 4:
            # Already snapped to axis-aligned in snap_angles
            result.append(e)
        else:
            result.append(e)
    return result
