"""Stage 2: Facade Element Detection using YOLOv8

Detects architectural elements: windows, doors, balconies, moldings,
columns, railings, shutters, AC units, signage, roof edges, floor lines.
"""

from dataclasses import dataclass

import numpy as np

from app.config import settings


@dataclass
class Detection:
    bbox: tuple[float, float, float, float]  # x1, y1, x2, y2
    class_name: str
    class_id: int
    confidence: float


# Facade element classes for fine-tuned model
FACADE_CLASSES = {
    0: "window",
    1: "door",
    2: "balcony",
    3: "molding",
    4: "column",
    5: "railing",
    6: "shutter",
    7: "ac_unit",
    8: "signage",
    9: "roof_edge",
    10: "floor_line",
    11: "wall_section",
}

# COCO class IDs that map to facade elements (for pre-trained model)
COCO_FACADE_MAP = {
    # COCO doesn't have direct facade classes, but some overlap
    # We'll use the pretrained model for initial detection
    # and add facade-specific detection later
}


class FacadeDetector:
    def __init__(self):
        self.model = None
        self._loaded = False

    def load(self):
        """Load YOLO model weights."""
        if self._loaded:
            return

        from ultralytics import YOLO

        self.model = YOLO(settings.YOLO_WEIGHTS)
        if settings.DEVICE == "cuda":
            self.model.to("cuda")
        self._loaded = True

    def detect(self, image: np.ndarray, confidence: float | None = None) -> list[Detection]:
        """Run detection on image, return list of detections."""
        if not self._loaded:
            self.load()

        if confidence is None:
            confidence = settings.CONFIDENCE_THRESHOLD

        results = self.model(image, conf=confidence, verbose=False)

        detections = []
        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue

            for i in range(len(boxes)):
                bbox = boxes.xyxy[i].cpu().numpy()
                cls_id = int(boxes.cls[i].cpu().numpy())
                conf = float(boxes.conf[i].cpu().numpy())
                cls_name = result.names.get(cls_id, f"class_{cls_id}")

                detections.append(
                    Detection(
                        bbox=(float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])),
                        class_name=cls_name,
                        class_id=cls_id,
                        confidence=conf,
                    )
                )

        return detections

    def detect_facades(self, image: np.ndarray) -> list[Detection]:
        """Detect facade-specific elements.

        Uses pretrained YOLO for initial detection, filtering for
        architecture-relevant classes. Will be replaced with fine-tuned
        model after training.
        """
        all_detections = self.detect(image)

        # For pretrained COCO model, we use a heuristic approach:
        # detect all objects, then use edge detection for architectural elements
        # that COCO doesn't cover (windows, moldings, etc.)
        facade_detections = all_detections

        # Add edge-based window detection as supplement
        window_detections = self._detect_windows_by_edges(image)
        facade_detections.extend(window_detections)

        return facade_detections

    def _detect_windows_by_edges(self, image: np.ndarray) -> list[Detection]:
        """Fallback window detection using classical CV when YOLO misses them.

        Uses edge detection + contour analysis to find rectangular regions
        that are likely windows.
        """
        import cv2

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        # Adaptive threshold for better edge detection
        thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)

        # Morphological operations to clean up
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        h, w = image.shape[:2]
        image_area = h * w
        detections = []

        for contour in contours:
            area = cv2.contourArea(contour)
            # Filter by area: windows are typically 0.5%-10% of image
            if area < image_area * 0.005 or area > image_area * 0.1:
                continue

            # Check rectangularity
            rect = cv2.minAreaRect(contour)
            box = cv2.boxPoints(rect)
            rect_area = rect[1][0] * rect[1][1]
            if rect_area == 0:
                continue

            rectangularity = area / rect_area
            if rectangularity < 0.7:  # Must be fairly rectangular
                continue

            # Check aspect ratio (windows are roughly 1:1.2 to 1:2.5)
            aspect = max(rect[1]) / (min(rect[1]) + 1e-6)
            if aspect > 3.0 or aspect < 0.8:
                continue

            x, y, bw, bh = cv2.boundingRect(contour)
            detections.append(
                Detection(
                    bbox=(float(x), float(y), float(x + bw), float(y + bh)),
                    class_name="window",
                    class_id=0,
                    confidence=0.6 * rectangularity,
                )
            )

        return detections


# Singleton instance
facade_detector = FacadeDetector()
