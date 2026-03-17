"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { parseDxf, type ParsedDxf, type SvgEntity, type DxfLayerInfo } from "@/lib/dxf-to-svg";
import { CodingOverlay } from "./coding-overlay";
import type { CodingConfig } from "@/types/job";

// Layer name → display color (matching ACI colors for SVG stroke)
const LAYER_COLORS: Record<string, string> = {
  WALLS: "#94a3b8",
  WINDOWS: "#22c55e",
  DOORS: "#ef4444",
  BALCONIES: "#3b82f6",
  MOLDINGS: "#eab308",
  COLUMNS: "#a855f7",
  DIMENSIONS: "#06b6d4",
  GRID_LINES: "#6b7280",
  FLOOR_LINES: "#9ca3af",
  TEXT: "#94a3b8",
};

const LAYER_BG_COLORS: Record<string, string> = {
  WALLS: "bg-slate-400",
  WINDOWS: "bg-green-500",
  DOORS: "bg-red-500",
  BALCONIES: "bg-blue-500",
  MOLDINGS: "bg-yellow-500",
  COLUMNS: "bg-purple-500",
  DIMENSIONS: "bg-cyan-500",
  GRID_LINES: "bg-gray-500",
  FLOOR_LINES: "bg-gray-400",
  TEXT: "bg-slate-400",
};

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DxfViewerProps {
  dxfUrl: string;
  className?: string;
  /** Coding overlay config to render on top of DXF entities */
  overlayConfig?: CodingConfig;
  /** Interaction mode: "pan" for default, "place" for click-to-place */
  interactionMode?: "pan" | "place";
  /** Callback when user clicks in "place" mode. Coordinates in SVG viewBox space. */
  onSvgClick?: (svgX: number, svgY: number) => void;
  /** Whether to show the layer toggle panel */
  showLayers?: boolean;
  /** Custom height for the SVG container */
  height?: number;
}

export function DxfViewer({
  dxfUrl,
  className = "",
  overlayConfig,
  interactionMode = "pan",
  onSvgClick,
  showLayers = true,
  height = 480,
}: DxfViewerProps) {
  const t = useTranslations("converter");
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [parsed, setParsed] = useState<ParsedDxf | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set());
  const [viewBox, setViewBox] = useState<ViewBox>({ x: 0, y: 0, w: 1000, h: 1000 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  // Compute the "fit" viewBox from parsed bounds
  const fitViewBox = useMemo<ViewBox | null>(() => {
    if (!parsed) return null;
    const { minX, minY, maxX, maxY } = parsed.bounds;
    const w = maxX - minX;
    const h = maxY - minY;
    const pad = Math.max(w, h) * 0.05;
    return {
      x: minX - pad,
      y: minY - pad,
      w: w + pad * 2,
      h: h + pad * 2,
    };
  }, [parsed]);

  // Fetch and parse DXF
  useEffect(() => {
    if (!dxfUrl) return;
    setLoading(true);
    setError(null);

    fetch(dxfUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        const result = parseDxf(text);
        setParsed(result);

        const { minX, minY, maxX, maxY } = result.bounds;
        const w = maxX - minX;
        const h = maxY - minY;
        const pad = Math.max(w, h) * 0.05;
        setViewBox({
          x: minX - pad,
          y: minY - pad,
          w: w + pad * 2,
          h: h + pad * 2,
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [dxfUrl]);

  // Convert screen coordinates to SVG viewBox coordinates
  const screenToSvg = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const mx = (clientX - rect.left) / rect.width;
      const my = (clientY - rect.top) / rect.height;
      return {
        x: viewBox.x + mx * viewBox.w,
        y: viewBox.y + my * viewBox.h,
      };
    },
    [viewBox]
  );

  // Zoom handler (wheel)
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;

      const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;

      setViewBox((prev) => {
        const newW = prev.w * factor;
        const newH = prev.h * factor;
        const newX = prev.x + (prev.w - newW) * mx;
        const newY = prev.y + (prev.h - newH) * my;
        return { x: newX, y: newY, w: newW, h: newH };
      });
    },
    []
  );

  // Pan handlers - in "place" mode, pan with middle button; in "pan" mode, left button
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const isPanButton =
        interactionMode === "place" ? e.button === 1 : e.button === 0;

      if (isPanButton) {
        e.preventDefault();
        setIsPanning(true);
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          vx: viewBox.x,
          vy: viewBox.y,
        };
        return;
      }

      // In "place" mode, left click places an item
      if (interactionMode === "place" && e.button === 0 && onSvgClick) {
        const coords = screenToSvg(e.clientX, e.clientY);
        if (coords) {
          onSvgClick(coords.x, coords.y);
        }
      }
    },
    [viewBox.x, viewBox.y, interactionMode, onSvgClick, screenToSvg]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning || !panStartRef.current || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const dx = ((e.clientX - panStartRef.current.x) / rect.width) * viewBox.w;
      const dy = ((e.clientY - panStartRef.current.y) / rect.height) * viewBox.h;
      setViewBox((prev) => ({
        ...prev,
        x: panStartRef.current!.vx - dx,
        y: panStartRef.current!.vy - dy,
      }));
    },
    [isPanning, viewBox.w, viewBox.h]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    panStartRef.current = null;
  }, []);

  // Fit to view
  const handleFit = useCallback(() => {
    if (fitViewBox) setViewBox(fitViewBox);
  }, [fitViewBox]);

  const handleZoomIn = useCallback(() => {
    setViewBox((prev) => {
      const factor = 1 / 1.3;
      const newW = prev.w * factor;
      const newH = prev.h * factor;
      return {
        x: prev.x + (prev.w - newW) / 2,
        y: prev.y + (prev.h - newH) / 2,
        w: newW,
        h: newH,
      };
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewBox((prev) => {
      const factor = 1.3;
      const newW = prev.w * factor;
      const newH = prev.h * factor;
      return {
        x: prev.x + (prev.w - newW) / 2,
        y: prev.y + (prev.h - newH) / 2,
        w: newW,
        h: newH,
      };
    });
  }, []);

  const toggleLayer = useCallback((name: string) => {
    setHiddenLayers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // Group entities by layer
  const entitiesByLayer = useMemo(() => {
    if (!parsed) return new Map<string, SvgEntity[]>();
    const map = new Map<string, SvgEntity[]>();
    for (const entity of parsed.entities) {
      const arr = map.get(entity.layer) || [];
      arr.push(entity);
      map.set(entity.layer, arr);
    }
    return map;
  }, [parsed]);

  const allLayers = useMemo<DxfLayerInfo[]>(() => {
    if (!parsed) return [];
    const seen = new Set<string>();
    const result: DxfLayerInfo[] = [];

    for (const l of parsed.layers) {
      if (!seen.has(l.name) && l.name !== "0") {
        seen.add(l.name);
        result.push(l);
      }
    }
    for (const name of entitiesByLayer.keys()) {
      if (!seen.has(name) && name !== "0") {
        seen.add(name);
        result.push({ name, color: LAYER_COLORS[name] || "#FFFFFF", visible: true });
      }
    }
    return result;
  }, [parsed, entitiesByLayer]);

  const cursorStyle =
    interactionMode === "place"
      ? "crosshair"
      : isPanning
        ? "grabbing"
        : "grab";

  if (loading) {
    return (
      <div className={`flex items-center justify-center rounded-lg border bg-muted h-80 ${className}`}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
          <span>{t("viewer.loading")}</span>
        </div>
      </div>
    );
  }

  if (error || !parsed) {
    return (
      <div className={`flex items-center justify-center rounded-lg border bg-muted h-80 ${className}`}>
        <p className="text-sm text-destructive">{t("viewer.parseError")}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleZoomIn}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
        </Button>
        <Button variant="outline" size="sm" onClick={handleZoomOut}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>
        </Button>
        <Button variant="outline" size="sm" onClick={handleFit}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </Button>
        <span className="text-xs text-muted-foreground ml-2">
          {interactionMode === "place" ? t("coding.panHint") : t("viewer.panHint")}
        </span>
      </div>

      {/* SVG Canvas */}
      <div
        ref={containerRef}
        className="relative rounded-lg border bg-zinc-900 overflow-hidden"
        style={{ height }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          className="w-full h-full select-none"
          style={{ cursor: cursorStyle }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {Array.from(entitiesByLayer.entries()).map(([layerName, layerEntities]) => {
            if (hiddenLayers.has(layerName)) return null;
            const strokeColor = LAYER_COLORS[layerName] || "#FFFFFF";
            const sw = viewBox.w * 0.001;

            return (
              <g key={layerName} data-layer={layerName}>
                {layerEntities.map((entity, i) => {
                  switch (entity.type) {
                    case "line":
                      return (
                        <line
                          key={i}
                          x1={entity.x1}
                          y1={entity.y1}
                          x2={entity.x2}
                          y2={entity.y2}
                          stroke={strokeColor}
                          strokeWidth={sw}
                          fill="none"
                        />
                      );
                    case "polyline": {
                      const d = entity.points
                        .map((p, idx) => `${idx === 0 ? "M" : "L"}${p[0]},${p[1]}`)
                        .join(" ") + (entity.closed ? " Z" : "");
                      return (
                        <path
                          key={i}
                          d={d}
                          stroke={strokeColor}
                          strokeWidth={sw}
                          fill="none"
                        />
                      );
                    }
                    case "text": {
                      const fontSize = entity.height * 0.8;
                      return (
                        <text
                          key={i}
                          x={entity.x}
                          y={entity.y}
                          fill={strokeColor}
                          fontSize={fontSize}
                          textAnchor="middle"
                          dominantBaseline="central"
                          transform={
                            entity.rotation
                              ? `rotate(${entity.rotation}, ${entity.x}, ${entity.y})`
                              : undefined
                          }
                        >
                          {entity.text}
                        </text>
                      );
                    }
                  }
                })}
              </g>
            );
          })}

          {/* Coding overlay on top of DXF entities */}
          {overlayConfig && parsed && (
            <CodingOverlay
              config={overlayConfig}
              strokeWidth={viewBox.w * 0.001}
              drawingHeight={parsed.bounds.maxY - parsed.bounds.minY}
              drawingMinY={parsed.bounds.minY}
              drawingMaxY={parsed.bounds.maxY}
            />
          )}
        </svg>
      </div>

      {/* Layer Toggle Panel */}
      {showLayers && (
        <div className="rounded-lg border p-4">
          <h4 className="font-medium mb-3">{t("viewer.layers")}</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {allLayers.map((layer) => {
              const isVisible = !hiddenLayers.has(layer.name);
              const bgColor = LAYER_BG_COLORS[layer.name] || "bg-white";
              return (
                <label
                  key={layer.name}
                  className="flex items-center gap-2 text-xs cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => toggleLayer(layer.name)}
                    className="sr-only"
                  />
                  <div
                    className={`h-3 w-3 rounded border ${
                      isVisible ? bgColor : "bg-transparent"
                    }`}
                  />
                  <span className={isVisible ? "" : "text-muted-foreground line-through"}>
                    {layer.name}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
