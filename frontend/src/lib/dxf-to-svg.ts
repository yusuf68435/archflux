/**
 * DXF → SVG data transformer.
 * Parses DXF text using dxf-parser and converts entities to SVG-renderable data.
 */
import DxfParser from "dxf-parser";
import type { IDxf, ILayer } from "dxf-parser";

// AutoCAD Color Index → hex (only the colors our DXF builder uses)
const ACI_COLORS: Record<number, string> = {
  0: "#000000",
  1: "#FF0000",   // Red - DOORS
  2: "#FFFF00",   // Yellow - MOLDINGS
  3: "#00FF00",   // Green - WINDOWS
  4: "#00FFFF",   // Cyan - DIMENSIONS
  5: "#0000FF",   // Blue - BALCONIES
  6: "#FF00FF",   // Magenta - COLUMNS
  7: "#FFFFFF",   // White - WALLS, TEXT
  8: "#808080",   // Gray - GRID_LINES
  9: "#C0C0C0",   // Light gray - FLOOR_LINES
};

export interface DxfLayerInfo {
  name: string;
  color: string;
  visible: boolean;
}

export interface SvgPolyline {
  type: "polyline";
  layer: string;
  points: [number, number][];
  closed: boolean;
}

export interface SvgLine {
  type: "line";
  layer: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SvgText {
  type: "text";
  layer: string;
  x: number;
  y: number;
  text: string;
  height: number;
  rotation: number;
}

export type SvgEntity = SvgPolyline | SvgLine | SvgText;

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ParsedDxf {
  layers: DxfLayerInfo[];
  entities: SvgEntity[];
  bounds: Bounds;
}

function getLayerColor(layer: ILayer | undefined, entityColorIndex?: number): string {
  const colorIndex = entityColorIndex && entityColorIndex !== 256
    ? entityColorIndex
    : layer?.colorIndex ?? 7;
  return ACI_COLORS[colorIndex] || ACI_COLORS[7];
}

export function parseDxf(dxfText: string): ParsedDxf {
  const parser = new DxfParser();
  const dxf: IDxf | null = parser.parseSync(dxfText);

  if (!dxf) throw new Error("Failed to parse DXF file");

  // Extract layers
  const layerMap = dxf.tables?.layer?.layers ?? {};
  const layers: DxfLayerInfo[] = Object.values(layerMap).map((l: ILayer) => ({
    name: l.name,
    color: ACI_COLORS[l.colorIndex] || ACI_COLORS[7],
    visible: l.visible !== false && !l.frozen,
  }));

  // Convert entities
  const entities: SvgEntity[] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  function updateBounds(x: number, y: number) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  for (const entity of dxf.entities) {
    const layerName = entity.layer || "0";

    switch (entity.type) {
      case "LWPOLYLINE": {
        const e = entity as any;
        const vertices: [number, number][] = (e.vertices || []).map(
          (v: { x: number; y: number }) => {
            // DXF Y is up, SVG Y is down → negate Y
            updateBounds(v.x, -v.y);
            return [v.x, -v.y] as [number, number];
          }
        );
        if (vertices.length >= 2) {
          entities.push({
            type: "polyline",
            layer: layerName,
            points: vertices,
            closed: !!e.shape,
          });
        }
        break;
      }
      case "LINE": {
        const e = entity as any;
        const verts = e.vertices || [];
        if (verts.length >= 2) {
          const x1 = verts[0].x;
          const y1 = -verts[0].y;
          const x2 = verts[1].x;
          const y2 = -verts[1].y;
          updateBounds(x1, y1);
          updateBounds(x2, y2);
          entities.push({ type: "line", layer: layerName, x1, y1, x2, y2 });
        }
        break;
      }
      case "TEXT":
      case "MTEXT": {
        const e = entity as any;
        const pos = e.startPoint || e.position || { x: 0, y: 0 };
        const x = pos.x;
        const y = -pos.y;
        updateBounds(x, y);
        entities.push({
          type: "text",
          layer: layerName,
          x,
          y,
          text: e.text || "",
          height: e.textHeight || 12,
          rotation: e.rotation || 0,
        });
        break;
      }
      // POLYLINE (heavyweight) - treat like LWPOLYLINE
      case "POLYLINE": {
        const e = entity as any;
        const vertices: [number, number][] = (e.vertices || []).map(
          (v: { x: number; y: number }) => {
            updateBounds(v.x, -v.y);
            return [v.x, -v.y] as [number, number];
          }
        );
        if (vertices.length >= 2) {
          entities.push({
            type: "polyline",
            layer: layerName,
            points: vertices,
            closed: !!e.shape,
          });
        }
        break;
      }
    }
  }

  // Handle empty bounds
  if (!isFinite(minX)) {
    minX = 0; minY = 0; maxX = 1000; maxY = 1000;
  }

  return {
    layers,
    entities,
    bounds: { minX, minY, maxX, maxY },
  };
}
