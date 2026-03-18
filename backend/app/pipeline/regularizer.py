"""Stage: Geometric Regularization for Traced Lines and Contours.

Cleans up pipeline output:
- Merges duplicate / near-identical structural lines (floor slabs, columns)
- Snaps floor lines to uniform vertical spacing when variance is low
- Snaps window/balcony contours to the nearest structural grid position
"""

import numpy as np

from app.pipeline.detector import TracedContour, TracedLine

# Lines within this many pixels of each other → merge into one
MERGE_H_PX: float = 10.0
MERGE_V_PX: float = 10.0

# Windows are snapped to grid positions within this distance
SNAP_PX: float = 18.0

# If floor-spacing std / median < this → regularize to uniform grid
REGULARITY_THRESHOLD: float = 0.22


def regularize_traces(
    lines: list[TracedLine],
    contours: list[TracedContour],
    image_width: int,
    image_height: int,
) -> tuple[list[TracedLine], list[TracedContour]]:
    """Full regularization pipeline.  Returns (lines, contours)."""
    lines = _merge_horizontal_lines(lines)
    lines = _merge_vertical_lines(lines)
    lines = _regularize_floor_spacing(lines)
    contours = _snap_windows_to_grid(lines, contours)
    return lines, contours


# ─── Horizontal line merging ─────────────────────────────────────────────────

def _merge_horizontal_lines(lines: list[TracedLine]) -> list[TracedLine]:
    """Merge floor-slab lines that share nearly the same Y position."""
    h_layers = {"structure", "FLOOR-SLABS", "detail"}
    h_lines = [l for l in lines if _is_horizontal(l) and l.layer in h_layers]
    others   = [l for l in lines if not (_is_horizontal(l) and l.layer in h_layers)]

    if not h_lines:
        return lines

    h_lines.sort(key=lambda l: _mid_y(l))
    merged: list[TracedLine] = []
    used: set[int] = set()

    for i, a in enumerate(h_lines):
        if i in used:
            continue
        ay = _mid_y(a)
        group = [a]
        for j, b in enumerate(h_lines):
            if j <= i or j in used:
                continue
            if abs(_mid_y(b) - ay) < MERGE_H_PX:
                group.append(b)
                used.add(j)

        avg_y = float(np.mean([_mid_y(l) for l in group]))
        min_x = min(min(l.x1, l.x2) for l in group)
        max_x = max(max(l.x1, l.x2) for l in group)
        merged.append(TracedLine(x1=min_x, y1=avg_y, x2=max_x, y2=avg_y,
                                  width=group[0].width, layer=group[0].layer))

    return others + merged


# ─── Vertical line merging ────────────────────────────────────────────────────

def _merge_vertical_lines(lines: list[TracedLine]) -> list[TracedLine]:
    """Merge column lines that share nearly the same X position."""
    v_layers = {"structure", "COLUMNS"}
    v_lines = [l for l in lines if _is_vertical(l) and l.layer in v_layers]
    others   = [l for l in lines if not (_is_vertical(l) and l.layer in v_layers)]

    if not v_lines:
        return lines

    v_lines.sort(key=lambda l: _mid_x(l))
    merged: list[TracedLine] = []
    used: set[int] = set()

    for i, a in enumerate(v_lines):
        if i in used:
            continue
        ax = _mid_x(a)
        group = [a]
        for j, b in enumerate(v_lines):
            if j <= i or j in used:
                continue
            if abs(_mid_x(b) - ax) < MERGE_V_PX:
                group.append(b)
                used.add(j)

        avg_x = float(np.mean([_mid_x(l) for l in group]))
        min_y = min(min(l.y1, l.y2) for l in group)
        max_y = max(max(l.y1, l.y2) for l in group)
        merged.append(TracedLine(x1=avg_x, y1=min_y, x2=avg_x, y2=max_y,
                                  width=group[0].width, layer=group[0].layer))

    return others + merged


# ─── Floor-spacing regularization ────────────────────────────────────────────

def _regularize_floor_spacing(lines: list[TracedLine]) -> list[TracedLine]:
    """Snap floor lines to a uniform vertical grid when spacing is regular."""
    h_layers = {"structure", "FLOOR-SLABS"}
    floor_lines = [l for l in lines if _is_horizontal(l) and l.layer in h_layers]
    others       = [l for l in lines if not (_is_horizontal(l) and l.layer in h_layers)]

    if len(floor_lines) < 3:
        return lines

    ys = sorted([_mid_y(l) for l in floor_lines])
    spacings = [ys[i + 1] - ys[i] for i in range(len(ys) - 1)]
    if not spacings:
        return lines

    median_sp = float(np.median(spacings))
    std_sp    = float(np.std(spacings))

    if median_sp <= 0 or std_sp / median_sp >= REGULARITY_THRESHOLD:
        return lines  # Too irregular — leave as-is

    # Snap all floors to the regular grid
    base_y = ys[0]
    regularized: list[TracedLine] = []
    for i, fl in enumerate(sorted(floor_lines, key=_mid_y)):
        ry = base_y + i * median_sp
        regularized.append(TracedLine(
            x1=fl.x1, y1=ry, x2=fl.x2, y2=ry,
            width=fl.width, layer=fl.layer,
        ))

    return others + regularized


# ─── Window snap to grid ──────────────────────────────────────────────────────

def _snap_windows_to_grid(
    lines: list[TracedLine],
    contours: list[TracedContour],
) -> list[TracedContour]:
    """Snap window/balcony contour corners to the nearest structural grid position."""
    floor_ys = sorted({
        _mid_y(l) for l in lines
        if _is_horizontal(l) and l.layer in {"structure", "FLOOR-SLABS"}
    })
    col_xs = sorted({
        _mid_x(l) for l in lines
        if _is_vertical(l) and l.layer in {"structure", "COLUMNS"}
    })

    if not floor_ys or not col_xs:
        return contours

    result: list[TracedContour] = []
    for c in contours:
        if c.layer not in {"detail", "WINDOWS", "BALCONIES"}:
            result.append(c)
            continue

        pts = c.points
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        x1, x2 = min(xs), max(xs)
        y1, y2 = min(ys), max(ys)

        sx1 = _nearest(x1, col_xs, SNAP_PX) or x1
        sx2 = _nearest(x2, col_xs, SNAP_PX) or x2
        sy1 = _nearest(y1, floor_ys, SNAP_PX * 2) or y1
        sy2 = _nearest(y2, floor_ys, SNAP_PX * 2) or y2

        if sx2 > sx1 and sy2 > sy1:
            result.append(TracedContour(
                points=[(sx1, sy1), (sx2, sy1), (sx2, sy2), (sx1, sy2)],
                layer=c.layer,
                closed=c.closed,
            ))
        else:
            result.append(c)

    return result


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _is_horizontal(l: TracedLine, tol: float = 6.0) -> bool:
    return abs(l.y1 - l.y2) < tol

def _is_vertical(l: TracedLine, tol: float = 6.0) -> bool:
    return abs(l.x1 - l.x2) < tol

def _mid_y(l: TracedLine) -> float:
    return (l.y1 + l.y2) / 2

def _mid_x(l: TracedLine) -> float:
    return (l.x1 + l.x2) / 2

def _nearest(value: float, candidates: list[float], threshold: float) -> float | None:
    if not candidates:
        return None
    best = min(candidates, key=lambda c: abs(c - value))
    return best if abs(best - value) <= threshold else None
