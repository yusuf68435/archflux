"""Tests for manual_coder module."""

import io
import pytest
import ezdxf

from app.pipeline.manual_coder import apply_manual_coding
from app.pipeline.dxf_builder import build_dxf
from app.pipeline.vectorizer import VectorElement


def _create_test_dxf(image_width=800, image_height=600) -> bytes:
    """Create a minimal DXF for testing."""
    elements = [
        VectorElement(
            class_name="wall_outline",
            element_type="polyline",
            points=[(0, 0), (image_width, 0), (image_width, image_height), (0, image_height)],
            bbox=(0, 0, image_width, image_height),
            confidence=1.0,
        ),
    ]
    return build_dxf(elements, image_width, image_height)


class TestApplyManualCoding:
    def test_adds_inner_axes(self):
        dxf_bytes = _create_test_dxf()
        config = {
            "innerAxes": [
                {"x": 100, "label": "A"},
                {"x": 300, "label": "B"},
            ],
            "outerAxes": [],
            "texts": [],
        }

        result = apply_manual_coding(dxf_bytes, config, 600)
        assert isinstance(result, bytes)
        assert len(result) > len(dxf_bytes)

        # Parse result and check grid lines were added
        doc = ezdxf.read(io.BytesIO(result))
        msp = doc.modelspace()
        grid_entities = [e for e in msp if e.dxf.layer == "GRID_LINES"]
        assert len(grid_entities) >= 2  # At least 2 axis lines

    def test_adds_outer_axes(self):
        dxf_bytes = _create_test_dxf()
        config = {
            "innerAxes": [],
            "outerAxes": [
                {"y": 100, "label": "±0.00"},
                {"y": 400, "label": "+3.50"},
            ],
            "texts": [],
        }

        result = apply_manual_coding(dxf_bytes, config, 600)
        doc = ezdxf.read(io.BytesIO(result))
        msp = doc.modelspace()
        grid_entities = [e for e in msp if e.dxf.layer == "GRID_LINES"]
        assert len(grid_entities) >= 2

    def test_adds_text_annotations(self):
        dxf_bytes = _create_test_dxf()
        config = {
            "innerAxes": [],
            "outerAxes": [],
            "texts": [
                {"x": 200, "y": 300, "value": "2.40m", "fontSize": 12},
            ],
        }

        result = apply_manual_coding(dxf_bytes, config, 600)
        doc = ezdxf.read(io.BytesIO(result))
        msp = doc.modelspace()
        text_entities = [e for e in msp if e.dxf.layer == "TEXT" and e.dxftype() == "TEXT"]
        assert any("2.40m" in e.dxf.text for e in text_entities)

    def test_validates_max_inner_axes(self):
        dxf_bytes = _create_test_dxf()
        config = {
            "innerAxes": [{"x": i * 10, "label": f"A{i}"} for i in range(50)],
            "outerAxes": [],
            "texts": [],
        }

        result = apply_manual_coding(dxf_bytes, config, 600)
        doc = ezdxf.read(io.BytesIO(result))
        msp = doc.modelspace()
        grid_lines = [e for e in msp if e.dxf.layer == "GRID_LINES" and e.dxftype() == "LINE"]
        # Should be capped at 30
        assert len(grid_lines) <= 30

    def test_validates_max_outer_axes(self):
        dxf_bytes = _create_test_dxf()
        config = {
            "innerAxes": [],
            "outerAxes": [{"y": i * 50, "label": f"{i}"} for i in range(20)],
            "texts": [],
        }

        result = apply_manual_coding(dxf_bytes, config, 600)
        doc = ezdxf.read(io.BytesIO(result))
        msp = doc.modelspace()
        grid_lines = [e for e in msp if e.dxf.layer == "GRID_LINES" and e.dxftype() == "LINE"]
        assert len(grid_lines) <= 10

    def test_empty_config_returns_unchanged(self):
        dxf_bytes = _create_test_dxf()
        config = {"innerAxes": [], "outerAxes": [], "texts": []}

        result = apply_manual_coding(dxf_bytes, config, 600)
        # Output should still be valid DXF
        doc = ezdxf.read(io.BytesIO(result))
        assert doc is not None
