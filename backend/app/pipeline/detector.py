"""Stage 2: Facade Structure Extraction

LSD-based architectural line detection with multi-evidence window scoring:
1. Find building bounds via edge-density projection + sky detection
2. Detect floor slab lines via LSD horizontal segments + spacing regularization
3. Detect column/wall lines via LSD vertical segments + bay regularization
4. Detect window openings via multi-evidence grid cell scoring
   (darkness + texture variance + edge density at boundary)
5. Detect balcony slabs via horizontal protrusion from building profile
"""

from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class Detection:
    bbox: tuple[float, float, float, float]
    class_name: str
    class_id: int
    confidence: float


@dataclass
class TracedLine:
    x1: float
    y1: float
    x2: float
    y2: float
    width: float
    layer: str


@dataclass
class TracedContour:
    points: list[tuple[float, float]]
    layer: str
    closed: bool


class FacadeDetector:

    def load(self):
        pass

    def detect_facades(self, image: np.ndarray) -> list[Detection]:
        return []

    def trace_edges(self, image: np.ndarray) -> tuple[list[TracedLine], list[TracedContour], dict]:
        h, w = image.shape[:2]

        # ── Structural meta (floor/column/window grid) ──────────────────────
        scale = 1.0
        target = 900
        if max(h, w) > target:
            scale = max(h, w) / target
            work = cv2.resize(image, (int(w / scale), int(h / scale)),
                              interpolation=cv2.INTER_AREA)
        else:
            work = image.copy()

        wh, ww = work.shape[:2]
        top, bottom, left, right = self._find_building_bounds(work, wh, ww)
        floor_ys = self._detect_floor_lines_lsd(work, top, bottom, left, right)
        column_xs = self._detect_column_lines_lsd(work, top, bottom, left, right)
        grid_xs = sorted(set([float(left)] + column_xs + [float(right)]))
        if len(floor_ys) >= 2:
            windows = self._score_windows_from_grid(
                work, top, bottom, left, right, floor_ys, grid_xs
            )
        else:
            windows = self._detect_windows_adaptive(work, top, bottom, left, right)

        window_rects = []
        for w_contour in windows:
            xs = [p[0] for p in w_contour.points]
            ys = [p[1] for p in w_contour.points]
            window_rects.append({
                "x": min(xs) * scale, "y": min(ys) * scale,
                "w": (max(xs) - min(xs)) * scale, "h": (max(ys) - min(ys)) * scale,
            })

        # Scale building bounds back to full-res coords
        full_top    = top    * scale
        full_bottom = bottom * scale
        full_left   = left   * scale
        full_right  = right  * scale

        full_floor_ys  = [y * scale for y in floor_ys]
        full_column_xs = [x * scale for x in column_xs]

        detect_meta = {
            "floor_ys":    full_floor_ys,
            "column_xs":   full_column_xs,
            "window_rects": window_rects,
        }

        # ── Build semantic lines/contours from structural detection ──────────
        lines: list[TracedLine] = []
        contours: list[TracedContour] = []

        # Building outline
        lines.append(TracedLine(x1=full_left,  y1=full_top,    x2=full_right, y2=full_top,    width=3.0, layer="outline"))
        lines.append(TracedLine(x1=full_right, y1=full_top,    x2=full_right, y2=full_bottom, width=3.0, layer="outline"))
        lines.append(TracedLine(x1=full_right, y1=full_bottom, x2=full_left,  y2=full_bottom, width=3.0, layer="outline"))
        lines.append(TracedLine(x1=full_left,  y1=full_bottom, x2=full_left,  y2=full_top,    width=3.0, layer="outline"))

        # Floor slab horizontal lines
        for fy in full_floor_ys:
            lines.append(TracedLine(x1=full_left, y1=fy, x2=full_right, y2=fy, width=2.0, layer="structure"))

        # Column vertical lines
        for cx in full_column_xs:
            lines.append(TracedLine(x1=cx, y1=full_top, x2=cx, y2=full_bottom, width=2.0, layer="COLUMNS"))

        # Window rectangles
        for wr in window_rects:
            wx1, wy1 = wr["x"], wr["y"]
            wx2, wy2 = wx1 + wr["w"], wy1 + wr["h"]
            contours.append(TracedContour(
                points=[(wx1, wy1), (wx2, wy1), (wx2, wy2), (wx1, wy2)],
                layer="WINDOWS",
                closed=True,
            ))

        # ── HED deep edge detection → DETAIL contours ────────────────────────
        # Run on downscaled image (500px) for speed
        hed_max = 500
        hed_scale = 1.0
        if max(h, w) > hed_max:
            hed_scale = max(h, w) / hed_max
            hed_img = cv2.resize(image, (int(w / hed_scale), int(h / hed_scale)))
        else:
            hed_img = image.copy()

        hed_edges = self._hed_edges(hed_img, threshold=0.25)
        sh, sw = hed_edges.shape[:2]
        min_arc_px = max(sh, sw) * 0.03

        raw_cnts, hier = cv2.findContours(hed_edges, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_TC89_L1)
        for i, cnt in enumerate(raw_cnts):
            if len(cnt) < 2:
                continue
            arc = cv2.arcLength(cnt, True)
            if arc < min_arc_px:
                continue
            area = cv2.contourArea(cnt)
            epsilon = max(0.5, 0.002 * arc)
            approx = cv2.approxPolyDP(cnt, epsilon, False)
            pts = [(float(p[0][0]) * hed_scale, float(p[0][1]) * hed_scale) for p in approx]
            if len(pts) < 2:
                continue
            is_closed = len(pts) >= 4 and area > 80
            if hier is not None and hier[0][i][2] >= 0:
                is_closed = True
            contours.append(TracedContour(points=pts, layer="detail", closed=is_closed))

        return lines, contours, detect_meta

    # ─── Building boundary ────────────────────────────────────────────────────

    def _find_building_bounds(self, image: np.ndarray, h: int, w: int
                               ) -> tuple[int, int, int, int]:
        """Find building bounding box via edge-density + sky-detection."""
        # Sky detection: high V, low S in HSV
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        sky_mask = cv2.inRange(hsv,
                               np.array([85, 0, 160]),
                               np.array([140, 80, 255]))
        # Also include white/gray overcast sky
        gray_sky = cv2.inRange(hsv,
                               np.array([0, 0, 180]),
                               np.array([180, 30, 255]))
        sky_mask = cv2.bitwise_or(sky_mask, gray_sky)

        # Find topmost row that is NOT predominantly sky
        sky_rows = np.sum(sky_mask, axis=1)
        sky_row_frac = sky_rows / (w * 255 + 1e-6)
        top = 0
        for r in range(h):
            if sky_row_frac[r] < 0.50:
                top = max(0, r - int(h * 0.01))
                break

        # Edge density for left/right/bottom
        blurred = cv2.GaussianBlur(image, (11, 11), 4)
        gray = cv2.cvtColor(blurred, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 25, 70)

        # Row projection for bottom
        row_proj = np.sum(edges, axis=1).astype(float)
        row_proj = self._smooth1d(row_proj, max(3, h // 40))
        row_thresh = np.max(row_proj) * 0.10

        bottom = h - 1
        for r in range(h - 1, top, -1):
            if row_proj[r] > row_thresh:
                bottom = min(h - 1, r + int(h * 0.01))
                break

        # Column projection for left/right (within building rows)
        col_proj = np.sum(edges[top:bottom, :], axis=0).astype(float)
        col_proj = self._smooth1d(col_proj, max(3, w // 40))
        col_thresh = np.max(col_proj) * 0.07

        left = 0
        for c in range(w):
            if col_proj[c] > col_thresh:
                left = max(0, c - int(w * 0.01))
                break

        right = w - 1
        for c in range(w - 1, -1, -1):
            if col_proj[c] > col_thresh:
                right = min(w - 1, c + int(w * 0.01))
                break

        # Sanity guards
        if bottom - top < h * 0.15:
            top, bottom = int(h * 0.05), int(h * 0.90)
        if right - left < w * 0.15:
            left, right = int(w * 0.05), int(w * 0.95)

        return int(top), int(bottom), int(left), int(right)

    # ─── LSD floor detection ─────────────────────────────────────────────────

    def _detect_floor_lines_lsd(self, image: np.ndarray, top: int, bottom: int,
                                  left: int, right: int) -> list[float]:
        """Detect horizontal floor/slab lines using LSD + clustering."""
        roi = image[top:bottom, left:right]
        if roi.size == 0:
            return []

        roi_h = bottom - top
        gray = self._smooth_gray(roi)

        # LSD (Line Segment Detector) — much more reliable than HoughLines
        lsd = cv2.createLineSegmentDetector(cv2.LSD_REFINE_STD)
        lines_raw = lsd.detect(gray)[0]

        if lines_raw is None or len(lines_raw) == 0:
            return self._sobel_floor_fallback(roi, roi_h, top)

        min_length = roi_h * 0.08  # at least 8% of building height
        h_ys: list[float] = []

        for seg in lines_raw:
            x1, y1, x2, y2 = seg[0]
            angle = abs(np.degrees(np.arctan2(y2 - y1, x2 - x1)))
            length = np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
            is_horizontal = angle < 12 or angle > 168
            if is_horizontal and length >= min_length:
                h_ys.append((y1 + y2) / 2)

        if not h_ys:
            return self._sobel_floor_fallback(roi, roi_h, top)

        # Cluster nearby Y values
        clustered = self._cluster_values(h_ys, threshold=roi_h * 0.025)
        # Regularize spacing
        clustered = self._regularize_spacing(clustered, roi_h)
        # Keep strong candidates (not sky area)
        clustered = [y for y in clustered if y > roi_h * 0.03]

        return [float(top + y) for y in sorted(clustered)[:16]]

    def _sobel_floor_fallback(self, roi: np.ndarray, roi_h: int, top: int) -> list[float]:
        """Fallback: Sobel-Y projection peaks."""
        gray = self._smooth_gray(roi)
        sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        row_proj = np.sum(np.abs(sobel_y), axis=1)
        min_sp = max(int(roi_h * 0.06), 8)
        local_ys = self._find_peaks(row_proj, min_sp, percentile=72, max_peaks=16)
        return [float(top + y) for y in local_ys]

    # ─── LSD column detection ─────────────────────────────────────────────────

    def _detect_column_lines_lsd(self, image: np.ndarray, top: int, bottom: int,
                                   left: int, right: int) -> list[float]:
        """Detect vertical column/wall lines using LSD + Sobel projection (combined)."""
        roi = image[top:bottom, left:right]
        if roi.size == 0:
            return []

        roi_h = bottom - top
        roi_w = right - left
        gray = self._smooth_gray(roi)

        v_xs: list[float] = []

        # LSD: tall vertical segments spanning multiple floors (structural columns)
        lsd = cv2.createLineSegmentDetector(cv2.LSD_REFINE_STD)
        lines_raw = lsd.detect(gray)[0]
        if lines_raw is not None and len(lines_raw) > 0:
            min_length = roi_h * 0.10  # must span ≥10% of building height
            for seg in lines_raw:
                x1, y1, x2, y2 = seg[0]
                angle = abs(np.degrees(np.arctan2(y2 - y1, x2 - x1)))
                length = np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
                is_vertical = 75 < angle < 105
                if is_vertical and length >= min_length:
                    v_xs.append((x1 + x2) / 2)

        # Sobel-X projection: finds major vertical edge clusters (bay divisions)
        # Use high percentile + wide min_spacing to find structural bays, not window frames
        sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        col_proj = np.sum(np.abs(sobel_x), axis=0)
        min_sp = max(int(roi_w * 0.07), 10)   # bay must be ≥7% of width
        sobel_xs = self._find_peaks(col_proj, min_sp, percentile=88, max_peaks=10)
        v_xs.extend([float(x) for x in sobel_xs])

        if not v_xs:
            return []

        # Cluster + regularize
        clustered = self._cluster_values(v_xs, threshold=roi_w * 0.04)
        # Remove edge positions (building outline already captured separately)
        margin = roi_w * 0.055
        clustered = [x for x in clustered if margin < x < roi_w - margin]
        clustered = self._regularize_spacing(clustered, roi_w, min_count=2)
        return [float(left + x) for x in sorted(clustered)[:14]]

    # ─── Multi-evidence window scoring ───────────────────────────────────────

    def _score_windows_from_grid(
        self,
        image: np.ndarray,
        top: int, bottom: int, left: int, right: int,
        floor_ys: list[float],
        column_xs: list[float],
    ) -> list[TracedContour]:
        """Score each structural grid cell using multiple evidence channels."""
        roi = image[top:bottom, left:right]
        if roi.size == 0:
            return []

        roi_h, roi_w = roi.shape[:2]

        # Prepare analysis channels
        blurred = cv2.GaussianBlur(roi, (7, 7), 2)
        gray = cv2.cvtColor(blurred, cv2.COLOR_BGR2GRAY)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        edges = cv2.Canny(gray, 30, 90)

        mean_lum = float(np.mean(gray))

        # Build grid boundaries
        ys = sorted(set([0] + [int(fy - top) for fy in floor_ys] + [roi_h]))
        xs = sorted(set([0] + [int(cx - left) for cx in column_xs] + [roi_w]))

        # Per-row score for cross-cell consistency
        row_scores: dict[int, list[float]] = {}

        cell_scores: list[tuple[int, int, float, int, int, int, int]] = []

        for i in range(len(ys) - 1):
            for j in range(len(xs) - 1):
                y1, y2 = ys[i], ys[i + 1]
                x1, x2 = xs[j], xs[j + 1]
                cw, ch = x2 - x1, y2 - y1

                # Skip cells too small or too large
                if cw < roi_w * 0.03 or ch < roi_h * 0.03:
                    continue
                if cw > roi_w * 0.75 or ch > roi_h * 0.50:
                    continue

                cell_gray = gray[y1:y2, x1:x2]
                cell_lap  = laplacian[y1:y2, x1:x2]

                # Evidence 1: Darkness (windows are dark)
                cell_mean = float(np.mean(cell_gray))
                darkness = max(0.0, 1.0 - cell_mean / (mean_lum + 1e-6))

                # Evidence 2: Low texture (glass is homogeneous)
                texture_var = float(np.std(np.abs(cell_lap)))
                texture_score = 1.0 / (1.0 + texture_var / 80.0)

                # Evidence 3: Edge density at cell boundary (windows have clear frames)
                boundary_mask = np.zeros_like(edges[y1:y2, x1:x2])
                bw = max(3, min(cw // 8, 12))
                bh = max(3, min(ch // 8, 12))
                boundary_mask[:bh, :] = 1
                boundary_mask[-bh:, :] = 1
                boundary_mask[:, :bw] = 1
                boundary_mask[:, -bw:] = 1
                cell_edges = edges[y1:y2, x1:x2]
                edge_density = float(np.sum(cell_edges * boundary_mask)) / (
                    boundary_mask.sum() * 255 + 1e-6
                )

                score = 0.45 * darkness + 0.35 * texture_score + 0.20 * edge_density
                row_scores.setdefault(i, []).append(score)
                cell_scores.append((i, j, score, x1, y1, x2, y2))

        # Cross-row consistency boost: if neighbors on same floor also score well
        windows: list[TracedContour] = []
        base_threshold = 0.28

        for i, j, score, x1, y1, x2, y2 in cell_scores:
            row = row_scores.get(i, [score])
            row_mean = float(np.mean(row))
            # If this row generally scores high, lower threshold slightly
            threshold = base_threshold * (0.85 if row_mean > base_threshold else 1.0)

            if score >= threshold:
                mx = max(4, int((x2 - x1) * 0.10))
                my = max(4, int((y2 - y1) * 0.08))
                fx1 = left + x1 + mx
                fx2 = left + x2 - mx
                fy1 = top  + y1 + my
                fy2 = top  + y2 - my
                if fx2 > fx1 and fy2 > fy1:
                    windows.append(TracedContour(
                        points=[
                            (float(fx1), float(fy1)),
                            (float(fx2), float(fy1)),
                            (float(fx2), float(fy2)),
                            (float(fx1), float(fy2)),
                        ],
                        layer="detail",
                        closed=True,
                    ))

        return windows

    # ─── Adaptive window detection (fallback) ─────────────────────────────────

    def _detect_windows_adaptive(self, image: np.ndarray, top: int, bottom: int,
                                   left: int, right: int) -> list[TracedContour]:
        """Adaptive threshold + contour fallback when no structural grid is found."""
        roi = image[top:bottom, left:right]
        if roi.size == 0:
            return []

        roi_h, roi_w = roi.shape[:2]
        gray = self._smooth_gray(roi, extra_bilateral=2)

        block_size = int(min(roi_h, roi_w) * 0.09)
        if block_size % 2 == 0:
            block_size += 1
        block_size = max(21, min(block_size, 181))

        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, blockSize=block_size, C=6,
        )
        k = np.ones((4, 4), np.uint8)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, k)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, k)

        raw_cnts, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        min_side = min(roi_h, roi_w) * 0.025
        min_area = roi_h * roi_w * 0.003
        max_area = roi_h * roi_w * 0.08
        max_w = roi_w * 0.45
        max_h = roi_h * 0.28

        bboxes: list[tuple[int, int, int, int]] = []
        for cnt in raw_cnts:
            area = cv2.contourArea(cnt)
            if area < min_area or area > max_area:
                continue
            x, y, cw, ch = cv2.boundingRect(cnt)
            if cw < min_side or ch < min_side or cw > max_w or ch > max_h:
                continue
            if max(cw, ch) / (min(cw, ch) + 1e-6) > 4.0:
                continue
            bboxes.append((x, y, cw, ch))

        bboxes = self._nms_boxes(bboxes, 0.30)

        windows: list[TracedContour] = []
        for (x, y, cw, ch) in bboxes[:30]:
            fx, fy = left + x, top + y
            windows.append(TracedContour(
                points=[
                    (float(fx), float(fy)),
                    (float(fx + cw), float(fy)),
                    (float(fx + cw), float(fy + ch)),
                    (float(fx), float(fy + ch)),
                ],
                layer="detail",
                closed=True,
            ))
        return windows

    # ─── Balcony detection ────────────────────────────────────────────────────

    def _detect_balconies(self, image: np.ndarray, top: int, bottom: int,
                           left: int, right: int,
                           floor_ys: list[float]) -> list[TracedContour]:
        """Detect balcony slabs via horizontal protrusion & railing density."""
        if len(floor_ys) < 2:
            return []

        roi = image[top:bottom, left:right]
        if roi.size == 0:
            return []

        roi_h, roi_w = roi.shape[:2]
        gray = cv2.cvtColor(cv2.GaussianBlur(roi, (5, 5), 2), cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 30, 80)

        balconies: list[TracedContour] = []

        for k in range(len(floor_ys) - 1):
            y1_f = int(floor_ys[k] - top)
            y2_f = int(floor_ys[k + 1] - top)
            if y2_f <= y1_f or y2_f - y1_f < roi_h * 0.04:
                continue

            band = edges[y1_f:y2_f, :]
            row_density = np.sum(band, axis=1) / (roi_w * 255 + 1e-6)
            mean_density = float(np.mean(row_density))

            # High horizontal edge density in the band → likely railing/balcony
            # Use strict thresholds to avoid false positives from floor slab edges
            if mean_density > 0.18:
                # Check if there's a protrusion: left/right non-background pixels
                band_gray = gray[y1_f:y2_f, :]
                # Count dark rows (balcony slab tends to be darker than wall)
                dark_frac = float(np.mean(band_gray < np.mean(gray) * 0.80))
                if dark_frac > 0.45:
                    # Add thin balcony slab as a contour (top of the band)
                    slab_y = float(top + y1_f + int((y2_f - y1_f) * 0.15))
                    balconies.append(TracedContour(
                        points=[
                            (float(left), slab_y),
                            (float(left + roi_w), slab_y),
                            (float(left + roi_w), slab_y + max(4, (y2_f - y1_f) * 0.08)),
                            (float(left), slab_y + max(4, (y2_f - y1_f) * 0.08)),
                        ],
                        layer="balcony",
                        closed=True,
                    ))

        return balconies[:8]

    # ─── Helpers ─────────────────────────────────────────────────────────────

    def _smooth_gray(self, image: np.ndarray, extra_bilateral: int = 2) -> np.ndarray:
        blurred = cv2.GaussianBlur(image, (7, 7), 2)
        for _ in range(extra_bilateral):
            blurred = cv2.bilateralFilter(blurred, d=9, sigmaColor=65, sigmaSpace=65)
        return cv2.cvtColor(blurred, cv2.COLOR_BGR2GRAY)

    def _smooth1d(self, arr: np.ndarray, kernel: int = 5) -> np.ndarray:
        if kernel < 3:
            return arr
        if kernel % 2 == 0:
            kernel += 1
        return np.convolve(arr, np.ones(kernel) / kernel, mode="same")

    def _cluster_values(self, values: list[float], threshold: float) -> list[float]:
        """Cluster nearby values and return cluster medians."""
        if not values:
            return []
        vals = sorted(values)
        clusters: list[list[float]] = [[vals[0]]]
        for v in vals[1:]:
            if v - clusters[-1][-1] < threshold:
                clusters[-1].append(v)
            else:
                clusters.append([v])
        return [float(np.median(c)) for c in clusters]

    def _regularize_spacing(self, positions: list[float], span: float,
                              min_count: int = 3) -> list[float]:
        """If spacing variance is low, snap to a uniform grid."""
        if len(positions) < min_count:
            return positions
        positions = sorted(positions)
        spacings = [positions[i + 1] - positions[i] for i in range(len(positions) - 1)]
        if not spacings:
            return positions
        median_sp = float(np.median(spacings))
        std_sp = float(np.std(spacings))
        if median_sp <= 0 or std_sp / median_sp > 0.22:
            return positions  # Too irregular — leave as-is
        # Snap to uniform grid
        base = positions[0]
        return [base + i * median_sp for i in range(len(positions))]

    def _find_peaks(self, projection: np.ndarray, min_spacing: int,
                    percentile: float = 75, max_peaks: int = 20) -> list[int]:
        if len(projection) == 0:
            return []
        smoothed = self._smooth1d(projection, min_spacing // 2 * 2 + 1)
        threshold = np.percentile(smoothed, percentile)
        peaks: list[int] = []
        i, n = 0, len(smoothed)
        while i < n:
            if smoothed[i] > threshold:
                j = i
                while j < n and smoothed[j] > threshold:
                    j += 1
                peak = int(i + np.argmax(smoothed[i:j]))
                peaks.append(peak)
                i = j + min_spacing
            else:
                i += 1
        peaks.sort(key=lambda p: smoothed[p], reverse=True)
        peaks = peaks[:max_peaks]
        peaks.sort()
        return peaks

    # ─── HED deep edge detection ────────────────────────────────────────────

    _hed_net = None

    class _CropLayer:
        """OpenCV DNN crop layer required by HED prototxt."""
        def __init__(self, params, blobs):
            self.startX = 0; self.startY = 0
            self.endX = 0; self.endY = 0
        def getMemoryShapes(self, inputs):
            inputShape, targetShape = inputs[0], inputs[1]
            batchSize, numChannels = inputShape[0], inputShape[1]
            H, W = targetShape[2], targetShape[3]
            self.startX = int((inputShape[3] - targetShape[3]) / 2)
            self.startY = int((inputShape[2] - targetShape[2]) / 2)
            self.endX = self.startX + W
            self.endY = self.startY + H
            return [[batchSize, numChannels, H, W]]
        def forward(self, inputs):
            return [inputs[0][:, :, self.startY:self.endY, self.startX:self.endX]]

    def _load_hed(self):
        """Load HED model (lazy, once)."""
        if FacadeDetector._hed_net is not None:
            return FacadeDetector._hed_net
        import os
        weights_dir = os.path.join(os.path.dirname(__file__), "..", "..", "weights")
        proto = os.path.join(weights_dir, "hed_deploy.prototxt")
        model = os.path.join(weights_dir, "hed_pretrained_bsds.caffemodel")
        if not os.path.exists(model):
            return None
        cv2.dnn_registerLayer("Crop", FacadeDetector._CropLayer)
        FacadeDetector._hed_net = cv2.dnn.readNetFromCaffe(proto, model)
        return FacadeDetector._hed_net

    def _hed_edges(self, image: np.ndarray, threshold: float = 0.25) -> np.ndarray:
        """Run HED (Holistically-nested Edge Detection) → binary edge map."""
        net = self._load_hed()
        if net is None:
            # Fallback: Canny if HED model not available
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
            return cv2.Canny(gray, 50, 150)
        h, w = image.shape[:2]
        blob = cv2.dnn.blobFromImage(
            image, scalefactor=1.0, size=(w, h),
            mean=(104.00698793, 116.66876762, 122.67891434),
            swapRB=False, crop=False,
        )
        net.setInput(blob)
        out = net.forward()[0, 0]
        out = cv2.resize(out, (w, h))
        out = (out * 255).clip(0, 255).astype(np.uint8)
        _, binary = cv2.threshold(out, int(threshold * 255), 255, cv2.THRESH_BINARY)
        return binary

    def _nms_boxes(self, boxes: list[tuple[int, int, int, int]],
                   iou_threshold: float = 0.3) -> list[tuple[int, int, int, int]]:
        if not boxes:
            return []
        boxes = sorted(boxes, key=lambda b: b[2] * b[3], reverse=True)
        kept: list[tuple[int, int, int, int]] = []
        suppressed: set[int] = set()
        for i, a in enumerate(boxes):
            if i in suppressed:
                continue
            kept.append(a)
            ax1, ay1, aw, ah = a
            ax2, ay2 = ax1 + aw, ay1 + ah
            for j in range(i + 1, len(boxes)):
                if j in suppressed:
                    continue
                bx1, by1, bw, bh = boxes[j]
                bx2, by2 = bx1 + bw, by1 + bh
                ix1, iy1 = max(ax1, bx1), max(ay1, by1)
                ix2, iy2 = min(ax2, bx2), min(ay2, by2)
                inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
                if inter == 0:
                    continue
                union = aw * ah + bw * bh - inter
                if inter / (union + 1e-6) > iou_threshold:
                    suppressed.add(j)
        return kept


facade_detector = FacadeDetector()
