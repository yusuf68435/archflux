"""Tests for dxf_builder module."""

import io
import pytest
import ezdxf

from app.pipeline.dxf_builder import (
    build_dxf,
    add_coding_to_dxf,
    add_dimensions_to_dxf,
    generate_preview,
    LAYERS,
    CLASS_TO_LAYER,
)
from app.pipeline.vectorizer import VectorElement


def _make_element(class_name, element_type, points, confidence=0.9):
    return VectorElement(
        class_name=class_name,
        element_type=element_type,
        points=points,
        bbox=(min(p[0] for p in points), min(p[1] for p in points),
              max(p[0] for p in points), max(p[1] for p in points)),
        confidence=confidence,
    )


class TestBuildDxf:
    def test_creates_valid_dxf(self):
        elements = [
            _make_element("window", "rectangle", [
                (100, 100), (200, 100), (200, 220), (100, 220)
            ]),
        ]
        result = build_dxf(elements, 800, 600)
        assert isinstance(result, bytes)
        doc = ezdxf.read(io.StringIO(result.decode("utf-8")))
        assert doc is not None

    def test_creates_all_layers(self):
        result = build_dxf([], 800, 600)
        doc = ezdxf.read(io.StringIO(result.decode("utf-8")))
        for layer_name in LAYERS:
            assert layer_name in doc.layers

    def test_maps_classes_to_correct_layers(self):
        elements = [
            _make_element("window", "rectangle", [
                (100, 100), (200, 100), (200, 220), (100, 220)
            ]),
            _make_element("door", "rectangle", [
                (300, 100), (400, 100), (400, 310), (300, 310)
            ]),
        ]
        result = build_dxf(elements, 800, 600)
        doc = ezdxf.read(io.StringIO(result.decode("utf-8")))
        msp = doc.modelspace()

        layers_used = set(e.dxf.layer for e in msp)
        assert "WINDOWS" in layers_used
        assert "DOORS" in layers_used

    def test_transforms_y_coordinates(self):
        elements = [
            _make_element("wall_outline", "line", [(0, 0), (800, 0)]),
        ]
        result = build_dxf(elements, 800, 600)
        doc = ezdxf.read(io.StringIO(result.decode("utf-8")))
        msp = doc.modelspace()

        lines = [e for e in msp if e.dxftype() == "LINE" and e.dxf.layer == "WALLS"]
        assert len(lines) >= 1
        # Y=0 in image should become Y=600 in CAD
        line = lines[0]
        assert line.dxf.start[1] == 600  # image Y=0 → CAD Y=600

    def test_adds_border(self):
        result = build_dxf([], 800, 600)
        doc = ezdxf.read(io.StringIO(result.decode("utf-8")))
        msp = doc.modelspace()

        # Border is a closed LWPOLYLINE with color=8
        border = [e for e in msp if e.dxftype() == "LWPOLYLINE" and e.dxf.get("color") == 8]
        assert len(border) == 1


class TestAddCodingToDxf:
    def test_adds_grid_lines_and_text(self):
        base_dxf = build_dxf([], 800, 600)
        config = {
            "innerAxes": [{"x": 200, "label": "A"}],
            "outerAxes": [{"y": 100, "label": "±0.00"}],
            "texts": [{"x": 400, "y": 300, "value": "TEST", "fontSize": 12}],
        }

        result = add_coding_to_dxf(base_dxf, config, 600)
        doc = ezdxf.read(io.StringIO(result.decode("utf-8")))
        msp = doc.modelspace()

        grid_lines = [e for e in msp if e.dxf.layer == "GRID_LINES"]
        assert len(grid_lines) >= 2  # 1 inner + 1 outer

        texts = [e for e in msp if e.dxf.layer == "TEXT" and e.dxftype() == "TEXT"]
        text_values = [e.dxf.text for e in texts]
        assert "A" in text_values
        assert "TEST" in text_values


class TestAddDimensionsToDxf:
    def test_adds_dimension_lines(self):
        elements = [
            _make_element("window", "rectangle", [
                (100, 100), (200, 100), (200, 220), (100, 220)
            ]),
        ]
        base_dxf = build_dxf(elements, 800, 600)

        result = add_dimensions_to_dxf(base_dxf, elements, 600)
        doc = ezdxf.read(io.StringIO(result.decode("utf-8")))
        msp = doc.modelspace()

        dim_entities = [e for e in msp if e.dxf.layer == "DIMENSIONS"]
        assert len(dim_entities) > 0  # Should have dimension lines + text
