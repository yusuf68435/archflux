"""Tests for auto_coder module."""

import pytest

from app.pipeline.auto_coder import (
    generate_auto_coding,
    _calculate_scale,
    _generate_inner_axes,
    _generate_dimension_texts,
)
from app.pipeline.vectorizer import VectorElement


def _make_element(
    class_name: str,
    element_type: str = "rectangle",
    points: list | None = None,
    confidence: float = 0.9,
) -> VectorElement:
    if points is None:
        points = [(0, 0), (100, 0), (100, 200), (0, 200)]
    return VectorElement(
        class_name=class_name,
        element_type=element_type,
        points=points,
        bbox=(min(p[0] for p in points), min(p[1] for p in points),
              max(p[0] for p in points), max(p[1] for p in points)),
        confidence=confidence,
    )


class TestCalculateScale:
    def test_scale_from_door_height(self):
        door = _make_element("door", "rectangle", [
            (100, 100), (200, 100), (200, 310), (100, 310)
        ])
        # Door height = 210px, reference = 2.1m → scale = 2.1/210 = 0.01
        scale = _calculate_scale([door], 2.1)
        assert abs(scale - 0.01) < 1e-6

    def test_scale_from_window_fallback(self):
        window = _make_element("window", "rectangle", [
            (50, 50), (150, 50), (150, 170), (50, 170)
        ])
        # Window height = 120px, assumes 1.2m → scale = 1.2/120 = 0.01
        scale = _calculate_scale([window], 2.1)
        assert abs(scale - 0.01) < 1e-6

    def test_scale_default_no_elements(self):
        scale = _calculate_scale([], 2.1)
        assert scale == 1.0 / 100


class TestGenerateInnerAxes:
    def test_generates_axes_from_windows(self):
        windows = [
            _make_element("window", "rectangle", [
                (100, 50), (200, 50), (200, 170), (100, 170)
            ]),
            _make_element("window", "rectangle", [
                (400, 50), (500, 50), (500, 170), (400, 170)
            ]),
        ]
        axes = _generate_inner_axes(windows, 800)
        assert len(axes) >= 2
        # Should have labels A, B, etc.
        labels = [a["label"] for a in axes]
        assert "A" in labels

    def test_empty_when_no_relevant_elements(self):
        elements = [_make_element("molding", "polyline")]
        axes = _generate_inner_axes(elements, 800)
        assert axes == []

    def test_merges_nearby_positions(self):
        windows = [
            _make_element("window", "rectangle", [
                (100, 50), (105, 50), (105, 170), (100, 170)
            ]),
        ]
        axes = _generate_inner_axes(windows, 800)
        # Should merge 100 and 105 since they're within 10px
        assert len(axes) <= 2


class TestGenerateAutoCoding:
    def test_generates_complete_config(self):
        elements = [
            _make_element("door", "rectangle", [
                (100, 200), (200, 200), (200, 410), (100, 410)
            ]),
            _make_element("window", "rectangle", [
                (300, 200), (400, 200), (400, 320), (300, 320)
            ]),
            _make_element("floor_line", "line", [(0, 100), (800, 100)]),
            _make_element("floor_line", "line", [(0, 450), (800, 450)]),
        ]

        result = generate_auto_coding(elements, 800, 600, reference_height=2.1)

        assert "innerAxes" in result
        assert "outerAxes" in result
        assert "texts" in result
        assert "scale" in result
        assert len(result["innerAxes"]) <= 30
        assert len(result["outerAxes"]) <= 10

    def test_limits_max_axes(self):
        # Create many windows to generate many axes
        windows = []
        for i in range(40):
            x = i * 20
            windows.append(_make_element("window", "rectangle", [
                (x, 50), (x + 15, 50), (x + 15, 170), (x, 170)
            ]))

        result = generate_auto_coding(windows, 1000, 500)
        assert len(result["innerAxes"]) <= 30

    def test_floor_levels_ordering(self):
        elements = [
            _make_element("floor_line", "line", [(0, 100), (800, 100)]),
            _make_element("floor_line", "line", [(0, 300), (800, 300)]),
            _make_element("floor_line", "line", [(0, 500), (800, 500)]),
        ]
        result = generate_auto_coding(elements, 800, 600)
        outer = result["outerAxes"]
        assert len(outer) == 3
        # Bottom floor line should be ±0.00
        assert outer[-1]["label"] == "±0.00"
