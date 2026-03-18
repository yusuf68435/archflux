"""Auto Coding: Automatic dimension and level annotation generator.

Reads detected floor lines and window/column positions from the traced
pipeline output and generates axis labels and dimension texts for the DXF.
"""

import numpy as np

from app.pipeline.detector import TracedContour, TracedLine


def generate_auto_coding(
    lines: list[TracedLine],
    contours: list[TracedContour],
    image_width: int,
    image_height: int,
    reference_height: float | None = None,
) -> dict:
    """Generate automatic coding configuration from traced pipeline output.

    Args:
        lines: TracedLine objects (floor slabs, columns)
        contours: TracedContour objects (windows, outline, balconies)
        image_width: Image width in pixels
        image_height: Image height in pixels
        reference_height: Known real-world height in metres (e.g. door = 2.1 m)

    Returns:
        Coding configuration dict: { innerAxes, outerAxes, texts, scale }
    """
    # Extract floor Y positions (horizontal structure lines)
    floor_ys = sorted({
        (l.y1 + l.y2) / 2
        for l in lines
        if _is_horizontal(l) and l.layer in {"structure", "FLOOR-SLABS"}
    })

    # Extract column X positions (vertical structure lines)
    col_xs = sorted({
        (l.x1 + l.x2) / 2
        for l in lines
        if _is_vertical(l) and l.layer in {"structure", "COLUMNS"}
    })

    # Window/door contours for scale estimation
    windows = [c for c in contours if c.layer in {"detail", "WINDOWS", "DOORS"}]

    scale = _calculate_scale(windows, floor_ys, reference_height)

    outer_axes = _build_outer_axes(floor_ys, scale, image_height)
    inner_axes = _build_inner_axes(col_xs, windows, image_width)
    texts = _build_dimension_texts(floor_ys, windows, scale)

    return {
        "innerAxes": inner_axes[:30],
        "outerAxes": outer_axes[:12],
        "texts":     texts,
        "scale":     scale,
    }


# ─── Scale estimation ─────────────────────────────────────────────────────────

def _calculate_scale(
    windows: list[TracedContour],
    floor_ys: list[float],
    reference_height: float | None,
) -> float:
    """Pixel → metre scale factor."""
    if reference_height and floor_ys and len(floor_ys) >= 2:
        spacings = [floor_ys[i + 1] - floor_ys[i] for i in range(len(floor_ys) - 1)]
        avg_floor_px = float(np.median(spacings))
        if avg_floor_px > 0:
            return reference_height / avg_floor_px

    if windows:
        heights_px = []
        for w in windows:
            ys = [p[1] for p in w.points]
            heights_px.append(max(ys) - min(ys))
        if heights_px:
            avg_h = float(np.mean(heights_px))
            if avg_h > 0:
                return 1.2 / avg_h  # assume 1.2 m typical window height

    return 1.0 / 100.0  # fallback: 1 px = 1 cm


# ─── Outer axes (horizontal floor levels) ─────────────────────────────────────

def _build_outer_axes(floor_ys: list[float], scale: float,
                       image_height: int) -> list[dict]:
    axes = []
    if not floor_ys:
        return axes
    ground_y = max(floor_ys)  # lowest detected floor = ±0.00
    for y in floor_ys:
        height_m = (ground_y - y) * scale
        label = f"+{height_m:.2f}" if height_m > 0.01 else "±0.00"
        axes.append({"y": y, "label": label})
    return axes


# ─── Inner axes (vertical column positions) ──────────────────────────────────

def _build_inner_axes(col_xs: list[float],
                       windows: list[TracedContour],
                       image_width: int) -> list[dict]:
    x_positions: list[float] = list(col_xs)

    # Add window left/right edges if no columns found
    if not col_xs:
        for w in windows:
            xs = [p[0] for p in w.points]
            x_positions.extend([min(xs), max(xs)])

    if not x_positions:
        return []

    # Cluster nearby X positions
    x_positions = sorted(set(round(x / 5) * 5 for x in x_positions))
    merged: list[float] = [x_positions[0]]
    for x in x_positions[1:]:
        if x - merged[-1] > 12:
            merged.append(x)

    axes = []
    for i, x in enumerate(merged):
        label = chr(65 + (i % 26))
        if i >= 26:
            label = chr(65 + (i // 26 - 1)) + chr(65 + (i % 26))
        axes.append({"x": x, "label": label})
    return axes


# ─── Dimension text annotations ──────────────────────────────────────────────

def _build_dimension_texts(
    floor_ys: list[float],
    windows: list[TracedContour],
    scale: float,
) -> list[dict]:
    texts = []

    # Floor-to-floor height labels
    for i in range(len(floor_ys) - 1):
        y1, y2 = floor_ys[i], floor_ys[i + 1]
        height_m = abs(y2 - y1) * scale
        texts.append({
            "x": -120,
            "y": (y1 + y2) / 2,
            "value": f"{height_m:.2f}m",
            "fontSize": 10,
        })

    # Window size labels
    for w in windows[:20]:
        xs = [p[0] for p in w.points]
        ys = [p[1] for p in w.points]
        wm = (max(xs) - min(xs)) * scale
        hm = (max(ys) - min(ys)) * scale
        texts.append({
            "x": (min(xs) + max(xs)) / 2,
            "y": (min(ys) + max(ys)) / 2,
            "value": f"{wm:.1f}×{hm:.1f}",
            "fontSize": 8,
        })

    return texts


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _is_horizontal(l: TracedLine, tol: float = 6.0) -> bool:
    return abs(l.y1 - l.y2) < tol

def _is_vertical(l: TracedLine, tol: float = 6.0) -> bool:
    return abs(l.x1 - l.x2) < tol
