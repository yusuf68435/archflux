"""Stage 6: DXF Assembly

Builds a properly layered DXF file from vectorized elements using ezdxf.
"""

import io
import tempfile
from pathlib import Path

import ezdxf
from ezdxf.enums import TextEntityAlignment

from app.pipeline.vectorizer import VectorElement

# Layer definitions: name -> (color, line_weight)
LAYERS = {
    "WALLS": (7, 50),  # White, 0.50mm
    "WINDOWS": (3, 25),  # Green, 0.25mm
    "DOORS": (1, 35),  # Red, 0.35mm
    "BALCONIES": (5, 25),  # Blue, 0.25mm
    "MOLDINGS": (2, 15),  # Yellow, 0.15mm
    "COLUMNS": (6, 30),  # Magenta, 0.30mm
    "DIMENSIONS": (4, 13),  # Cyan, 0.13mm
    "GRID_LINES": (8, 9),  # Gray, 0.09mm
    "TEXT": (7, 13),  # White, 0.13mm
    "FLOOR_LINES": (9, 25),  # Light gray, 0.25mm
}

# Map element class names to DXF layers
CLASS_TO_LAYER = {
    "window": "WINDOWS",
    "door": "DOORS",
    "balcony": "BALCONIES",
    "molding": "MOLDINGS",
    "column": "COLUMNS",
    "railing": "BALCONIES",
    "shutter": "WINDOWS",
    "ac_unit": "WALLS",
    "signage": "TEXT",
    "roof_edge": "WALLS",
    "floor_line": "FLOOR_LINES",
    "wall_section": "WALLS",
    "wall_outline": "WALLS",
}


def build_dxf(elements: list[VectorElement], image_width: int, image_height: int) -> bytes:
    """Build a DXF file from vectorized elements.

    Returns DXF file content as bytes.
    """
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()

    # Create layers
    for name, (color, lineweight) in LAYERS.items():
        doc.layers.add(name, color=color, lineweight=lineweight)

    # Coordinate transformation: image coordinates (origin top-left, Y down)
    # to CAD coordinates (origin bottom-left, Y up)
    def transform_y(y: float) -> float:
        return image_height - y

    def transform_point(x: float, y: float) -> tuple[float, float]:
        return (x, transform_y(y))

    # Add elements to DXF
    for element in elements:
        layer = CLASS_TO_LAYER.get(element.class_name, "WALLS")

        if element.element_type == "rectangle":
            _add_rectangle(msp, element, layer, transform_point)
        elif element.element_type == "line":
            _add_line(msp, element, layer, transform_point)
        elif element.element_type == "polyline":
            _add_polyline(msp, element, layer, transform_point)

    # Add border frame
    _add_border(msp, image_width, image_height)

    # Save to bytes (ezdxf.write uses text stream, encode to bytes)
    stream = io.StringIO()
    doc.write(stream)
    return stream.getvalue().encode("utf-8")


def _add_rectangle(msp, element: VectorElement, layer: str, transform):
    """Add a rectangle (closed LWPOLYLINE) to modelspace."""
    if len(element.points) < 4:
        return

    points = [transform(p[0], p[1]) for p in element.points]
    msp.add_lwpolyline(points, close=True, dxfattribs={"layer": layer})


def _add_line(msp, element: VectorElement, layer: str, transform):
    """Add a line to modelspace."""
    if len(element.points) < 2:
        return

    p1 = transform(element.points[0][0], element.points[0][1])
    p2 = transform(element.points[1][0], element.points[1][1])
    msp.add_line(p1, p2, dxfattribs={"layer": layer})


def _add_polyline(msp, element: VectorElement, layer: str, transform):
    """Add a polyline to modelspace."""
    if len(element.points) < 2:
        return

    points = [transform(p[0], p[1]) for p in element.points]
    closed = element.class_name in ("wall_outline", "balcony", "molding")
    msp.add_lwpolyline(points, close=closed, dxfattribs={"layer": layer})


def _add_border(msp, width: int, height: int):
    """Add a border frame around the drawing."""
    margin = 50
    points = [
        (-margin, -margin),
        (width + margin, -margin),
        (width + margin, height + margin),
        (-margin, height + margin),
    ]
    msp.add_lwpolyline(points, close=True, dxfattribs={"layer": "WALLS", "color": 8})


def add_dimensions_to_dxf(
    dxf_bytes: bytes,
    elements: list[VectorElement],
    image_height: int,
    scale_factor: float = 1.0,
) -> bytes:
    """Add dimension annotations to an existing DXF."""
    doc = ezdxf.read(io.BytesIO(dxf_bytes))
    msp = doc.modelspace()

    def transform_y(y: float) -> float:
        return image_height - y

    # Add dimensions for windows and doors
    for element in elements:
        if element.class_name not in ("window", "door"):
            continue
        if element.element_type != "rectangle" or len(element.points) < 4:
            continue

        pts = element.points
        xs = [p[0] for p in pts]
        ys = [transform_y(p[1]) for p in pts]

        x_min, x_max = min(xs), max(xs)
        y_min, y_max = min(ys), max(ys)

        width = (x_max - x_min) * scale_factor
        height = (y_max - y_min) * scale_factor

        # Width dimension below element
        _add_linear_dimension(msp, (x_min, y_min), (x_max, y_min), y_min - 30, f"{width:.0f}")
        # Height dimension to the right
        _add_linear_dimension_vertical(msp, (x_max, y_min), (x_max, y_max), x_max + 30, f"{height:.0f}")

    stream = io.StringIO()
    doc.write(stream)
    return stream.getvalue().encode("utf-8")


def _add_linear_dimension(msp, p1, p2, text_y, text):
    """Add a horizontal linear dimension."""
    mid_x = (p1[0] + p2[0]) / 2
    msp.add_line(p1, p2, dxfattribs={"layer": "DIMENSIONS"})

    # Tick marks
    tick_len = 5
    msp.add_line((p1[0], p1[1] - tick_len), (p1[0], p1[1] + tick_len), dxfattribs={"layer": "DIMENSIONS"})
    msp.add_line((p2[0], p2[1] - tick_len), (p2[0], p2[1] + tick_len), dxfattribs={"layer": "DIMENSIONS"})

    # Text
    msp.add_text(
        text,
        height=12,
        dxfattribs={"layer": "DIMENSIONS", "insert": (mid_x, text_y)},
    ).set_placement((mid_x, text_y), align=TextEntityAlignment.MIDDLE_CENTER)


def _add_linear_dimension_vertical(msp, p1, p2, text_x, text):
    """Add a vertical linear dimension."""
    mid_y = (p1[1] + p2[1]) / 2
    msp.add_line(p1, p2, dxfattribs={"layer": "DIMENSIONS"})

    tick_len = 5
    msp.add_line((p1[0] - tick_len, p1[1]), (p1[0] + tick_len, p1[1]), dxfattribs={"layer": "DIMENSIONS"})
    msp.add_line((p2[0] - tick_len, p2[1]), (p2[0] + tick_len, p2[1]), dxfattribs={"layer": "DIMENSIONS"})

    msp.add_text(
        text,
        height=12,
        rotation=90,
        dxfattribs={"layer": "DIMENSIONS", "insert": (text_x, mid_y)},
    ).set_placement((text_x, mid_y), align=TextEntityAlignment.MIDDLE_CENTER)


def add_coding_to_dxf(
    dxf_bytes: bytes,
    coding_config: dict,
    image_height: int,
) -> bytes:
    """Add manual coding (axis lines, text) to an existing DXF."""
    doc = ezdxf.read(io.BytesIO(dxf_bytes))
    msp = doc.modelspace()

    def transform_y(y: float) -> float:
        return image_height - y

    # Inner axis lines (vertical)
    for axis in coding_config.get("innerAxes", []):
        x = axis["x"]
        label = axis.get("label", "")
        msp.add_line(
            (x, -50), (x, image_height + 50),
            dxfattribs={"layer": "GRID_LINES"},
        )
        if label:
            msp.add_text(
                label,
                height=15,
                dxfattribs={"layer": "TEXT", "insert": (x, image_height + 60)},
            ).set_placement((x, image_height + 60), align=TextEntityAlignment.MIDDLE_CENTER)

    # Outer axis lines (horizontal)
    for axis in coding_config.get("outerAxes", []):
        y = transform_y(axis["y"])
        label = axis.get("label", "")
        msp.add_line(
            (-50, y), (10000, y),
            dxfattribs={"layer": "GRID_LINES"},
        )
        if label:
            msp.add_text(
                label,
                height=15,
                dxfattribs={"layer": "TEXT", "insert": (-80, y)},
            ).set_placement((-80, y), align=TextEntityAlignment.MIDDLE_CENTER)

    # Text annotations
    for text_item in coding_config.get("texts", []):
        x = text_item["x"]
        y = transform_y(text_item["y"])
        value = text_item["value"]
        font_size = text_item.get("fontSize", 12)
        msp.add_text(
            value,
            height=font_size,
            dxfattribs={"layer": "TEXT", "insert": (x, y)},
        ).set_placement((x, y), align=TextEntityAlignment.MIDDLE_CENTER)

    stream = io.StringIO()
    doc.write(stream)
    return stream.getvalue().encode("utf-8")


def generate_preview(dxf_bytes: bytes) -> bytes:
    """Generate a PNG preview of the DXF file."""
    doc = ezdxf.read(io.BytesIO(dxf_bytes))

    try:
        import matplotlib

        matplotlib.use("Agg")
        from ezdxf.addons.drawing import Frontend, RenderContext
        from ezdxf.addons.drawing.matplotlib import MatplotlibBackend

        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(16, 12))
        ctx = RenderContext(doc)
        out = MatplotlibBackend(ax)
        Frontend(ctx, out).draw_layout(doc.modelspace())

        ax.set_aspect("equal")
        ax.set_axis_off()

        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=150, bbox_inches="tight", pad_inches=0.1)
        plt.close(fig)
        return buf.getvalue()
    except ImportError:
        # matplotlib not available, return empty
        return b""
