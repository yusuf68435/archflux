"""Stage 3: Element Segmentation using SAM 2

Takes YOLO detection bounding boxes and produces pixel-precise masks
for each architectural element.
"""

import numpy as np

from app.config import settings
from app.pipeline.detector import Detection


class FacadeSegmentor:
    def __init__(self):
        self.predictor = None
        self._loaded = False

    def load(self):
        """Load SAM 2 model."""
        if self._loaded:
            return

        try:
            from segment_anything import SamPredictor, sam_model_registry

            sam = sam_model_registry["vit_h"](checkpoint=settings.SAM_CHECKPOINT)
            if settings.DEVICE == "cuda":
                sam.to("cuda")
            self.predictor = SamPredictor(sam)
            self._loaded = True
        except ImportError:
            print("SAM not available, using fallback contour-based segmentation")
            self._loaded = True

    def segment(self, image: np.ndarray, detections: list[Detection]) -> list[dict]:
        """Generate masks for each detection.

        Returns list of {detection, mask, contour} dicts.
        """
        if not self._loaded:
            self.load()

        results = []

        if self.predictor is not None:
            self.predictor.set_image(image)

            for det in detections:
                mask = self._segment_with_sam(det)
                if mask is not None:
                    results.append({
                        "detection": det,
                        "mask": mask,
                    })
        else:
            # Fallback: use bounding box as rough mask
            for det in detections:
                mask = self._bbox_to_mask(image.shape[:2], det)
                results.append({
                    "detection": det,
                    "mask": mask,
                })

        return results

    def _segment_with_sam(self, detection: Detection) -> np.ndarray | None:
        """Use SAM to segment a single detection."""
        x1, y1, x2, y2 = detection.bbox
        input_box = np.array([x1, y1, x2, y2])

        masks, scores, _ = self.predictor.predict(
            point_coords=None,
            point_labels=None,
            box=input_box[None, :],
            multimask_output=True,
        )

        if len(masks) == 0:
            return None

        # Pick mask with highest score
        best_idx = np.argmax(scores)
        return masks[best_idx]

    def _bbox_to_mask(self, image_shape: tuple, detection: Detection) -> np.ndarray:
        """Create a simple rectangular mask from bounding box (fallback)."""
        h, w = image_shape
        mask = np.zeros((h, w), dtype=np.uint8)
        x1, y1, x2, y2 = detection.bbox
        x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
        x1 = max(0, min(x1, w - 1))
        y1 = max(0, min(y1, h - 1))
        x2 = max(0, min(x2, w))
        y2 = max(0, min(y2, h))
        mask[y1:y2, x1:x2] = 255
        return mask


# Singleton instance
facade_segmentor = FacadeSegmentor()
