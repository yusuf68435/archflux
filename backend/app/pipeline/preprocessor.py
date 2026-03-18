"""Stage 1: Image Preprocessing

- Perspective correction via LSD + RANSAC vanishing point
- Resolution management (8K max)
- CLAHE contrast enhancement
"""

import cv2
import numpy as np

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
    return cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)


def correct_perspective(image: np.ndarray) -> np.ndarray:
    """Perspective correction using LSD + RANSAC vanishing point.

    Steps:
    1. LSD detects line segments (more robust than HoughLinesP).
    2. Classify near-vertical / near-horizontal segments.
    3. Measure median signed tilt of vertical segments.
    4. If tilt <= 3 deg -> return original (already rectified).
    5. RANSAC finds the vertical vanishing point (VP).
    6. VP very far away (>6x image height) -> simple rotation deskew.
    7. VP nearby -> keystone warp.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    h, w = image.shape[:2]

    lsd = cv2.createLineSegmentDetector(cv2.LSD_REFINE_STD)
    raw = lsd.detect(gray)[0]
    if raw is None or len(raw) < 8:
        return image

    min_len = max(h, w) * 0.04
    v_segs = []  # near-vertical  (angle_from_vert <= 30 deg)
    h_segs = []  # near-horizontal (angle_from_vert >= 60 deg)

    for seg in raw:
        x1, y1, x2, y2 = seg[0]
        dx, dy = float(x2 - x1), float(y2 - y1)
        length = np.hypot(dx, dy)
        if length < min_len:
            continue
        # afv: 0 = perfectly vertical, 90 = horizontal
        afv = abs(np.degrees(np.arctan2(abs(dx), abs(dy))))
        if afv < 30:
            v_segs.append((x1, y1, x2, y2, length, afv))
        elif afv > 60:
            h_segs.append((x1, y1, x2, y2, length))

    if len(v_segs) < 4:
        return image

    # Measure median signed tilt (positive = leaning right)
    signed_tilts = []
    for x1, y1, x2, y2, _, _ in v_segs:
        if y1 > y2:
            x1, y1, x2, y2 = x2, y2, x1, y1  # ensure top-first
        signed_tilts.append(np.degrees(np.arctan2(x2 - x1, y2 - y1)))

    median_tilt = float(np.median(signed_tilts))
    if abs(median_tilt) < 3.0:
        return image  # Already well-rectified

    # RANSAC vanishing point
    vp = _ransac_vp(v_segs, w, h)
    if vp is None:
        return _deskew(image, median_tilt)

    vpx, vpy = vp
    # If VP is very far -> nearly parallel lines -> just deskew
    if abs(vpy) > h * 6 or abs(vpy - h) > h * 6:
        return _deskew(image, median_tilt)

    return _keystone_correct(image, vp, v_segs, w, h)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _ransac_vp(
    v_segs: list,
    w: int,
    h: int,
    iterations: int = 300,
    inlier_thr: float = 2.5,
) -> tuple | None:
    """Find vertical vanishing point via RANSAC.

    Represents each segment as a homogeneous line l = p1 x p2,
    then finds the point that maximises the number of inlier segments
    (angular distance from segment direction to VP direction < inlier_thr).
    Refines the result as a length-weighted mean of inlier intersections.
    """
    lines = []
    for x1, y1, x2, y2, length, _ in v_segs:
        p1 = np.array([x1, y1, 1.0])
        p2 = np.array([x2, y2, 1.0])
        lines.append((np.cross(p1, p2), length))

    n = len(lines)
    if n < 2:
        return None

    rng = np.random.default_rng(42)
    best_count = 0
    best_vp: np.ndarray | None = None

    for _ in range(iterations):
        i, j = rng.choice(n, 2, replace=False)
        l1, _ = lines[i]
        l2, _ = lines[j]
        vp_h = np.cross(l1, l2)
        if abs(vp_h[2]) < 1e-9:
            continue
        vp_c = vp_h[:2] / vp_h[2]

        count = sum(
            1 for k in range(n)
            if _angle_to_vp(*v_segs[k][:4], vp_c) < inlier_thr
        )
        if count > best_count:
            best_count = count
            best_vp = vp_c

    if best_vp is None or best_count < max(4, int(n * 0.4)):
        return None

    # Refine: weighted mean over inlier pair intersections
    inlier_lines = [
        (lines[k][0], lines[k][1])
        for k in range(n)
        if _angle_to_vp(*v_segs[k][:4], best_vp) < inlier_thr
    ]

    sum_vp = np.zeros(2)
    sum_w = 0.0
    for ki in range(len(inlier_lines)):
        for mi in range(ki + 1, len(inlier_lines)):
            l1, w1 = inlier_lines[ki]
            l2, w2 = inlier_lines[mi]
            vp_h = np.cross(l1, l2)
            if abs(vp_h[2]) < 1e-9:
                continue
            weight = w1 * w2
            sum_vp += (vp_h[:2] / vp_h[2]) * weight
            sum_w += weight

    if sum_w < 1e-9:
        return float(best_vp[0]), float(best_vp[1])

    refined = sum_vp / sum_w
    return float(refined[0]), float(refined[1])


def _angle_to_vp(
    x1: float, y1: float, x2: float, y2: float, vp: np.ndarray
) -> float:
    """Angle (degrees) between segment direction and direction toward VP."""
    mx, my = (x1 + x2) / 2.0, (y1 + y2) / 2.0
    seg_dir = np.array([x2 - x1, y2 - y1], dtype=float)
    vp_dir = np.array([vp[0] - mx, vp[1] - my], dtype=float)
    sn = np.linalg.norm(seg_dir)
    vn = np.linalg.norm(vp_dir)
    if sn < 1e-9 or vn < 1e-9:
        return 90.0
    cos_a = min(1.0, abs(np.dot(seg_dir / sn, vp_dir / vn)))
    return float(np.degrees(np.arccos(cos_a)))


def _deskew(image: np.ndarray, angle_deg: float) -> np.ndarray:
    """Rotate image by -angle_deg to remove tilt. Clamps to +-8 deg."""
    angle_deg = max(-8.0, min(8.0, angle_deg))
    h, w = image.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2.0, h / 2.0), -angle_deg, 1.0)
    return cv2.warpAffine(
        image, M, (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REPLICATE,
    )


def _keystone_correct(
    image: np.ndarray,
    vp: tuple,
    v_segs: list,
    w: int,
    h: int,
) -> np.ndarray:
    """Correct converging verticals using the estimated vertical VP.

    Finds the trapezoidal region spanned by near-vertical segments and
    maps it to a rectangle. Displacement is clamped to 15% of image
    width to prevent over-correction on unusual images.
    """
    vpx, vpy = vp
    if abs(vpy) < 1:
        return image

    # Horizontal span: 10th-90th percentile of vertical segment midpoints
    x_coords = sorted([(x1 + x2) / 2.0 for x1, y1, x2, y2, *_ in v_segs])
    left_x = float(np.percentile(x_coords, 10))
    right_x = float(np.percentile(x_coords, 90))

    if (right_x - left_x) < w * 0.2:
        return image

    def x_at_y(px: float, py: float, target_y: float) -> float | None:
        """X coord where line VP->(px,py) passes through target_y."""
        dy = py - vpy
        if abs(dy) < 1e-9:
            return None
        t = (target_y - vpy) / dy
        return vpx + t * (px - vpx)

    tl_x = x_at_y(left_x, h, 0.0)
    tr_x = x_at_y(right_x, h, 0.0)
    if tl_x is None or tr_x is None:
        return image

    # Clamp: max 15% shift per corner
    max_shift = w * 0.15
    tl_x = max(left_x - max_shift, min(left_x + max_shift, tl_x))
    tr_x = max(right_x - max_shift, min(right_x + max_shift, tr_x))

    # Guard: don't apply inverted keystone
    if (tr_x - tl_x) > (right_x - left_x) * 1.3:
        return image

    src = np.float32([[tl_x, 0], [tr_x, 0], [right_x, h], [left_x, h]])
    dst = np.float32([[left_x, 0], [right_x, 0], [right_x, h], [left_x, h]])
    M = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(
        image, M, (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REPLICATE,
    )


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
    x = max(0, min(int(region["x"] * w), w - 1))
    y = max(0, min(int(region["y"] * h), h - 1))
    cw = min(int(region["width"] * w), w - x)
    ch = min(int(region["height"] * h), h - y)
    return image[y:y + ch, x:x + cw]


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
