"""Manual Coding: User-placed axis lines and text annotations.

Receives coding configuration from the frontend and renders
it into DXF entities.
"""

from app.pipeline.dxf_builder import add_coding_to_dxf


def apply_manual_coding(dxf_bytes: bytes, coding_config: dict, image_height: int) -> bytes:
    """Apply manual coding configuration to an existing DXF file.

    Args:
        dxf_bytes: Existing DXF file content
        coding_config: {
            "innerAxes": [{"x": float, "label": str}, ...],  # max 30
            "outerAxes": [{"y": float, "label": str}, ...],  # max 10
            "texts": [{"x": float, "y": float, "value": str, "fontSize": int}, ...]
        }
        image_height: Original image height for coordinate transform

    Returns:
        Updated DXF file content as bytes.
    """
    # Validate limits
    inner_axes = coding_config.get("innerAxes", [])[:30]
    outer_axes = coding_config.get("outerAxes", [])[:10]
    texts = coding_config.get("texts", [])

    validated_config = {
        "innerAxes": inner_axes,
        "outerAxes": outer_axes,
        "texts": texts,
    }

    return add_coding_to_dxf(dxf_bytes, validated_config, image_height)
