"use client";

import { useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { DxfViewer } from "./dxf-viewer";
import { ErrorBoundary } from "@/components/ui/error-boundary";

interface ComparisonViewProps {
  imageUrl: string;
  dxfUrl: string;
}

export function ComparisonView({ imageUrl, dxfUrl }: ComparisonViewProps) {
  const t = useTranslations("converter");
  const containerRef = useRef<HTMLDivElement>(null);
  const [splitPct, setSplitPct] = useState(50);
  const dragging = useRef(false);

  const onMouseDown = useCallback(() => {
    dragging.current = true;
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setSplitPct(Math.max(20, Math.min(80, pct)));
  }, []);

  const stopDrag = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex h-[560px] rounded-lg border overflow-hidden select-none cursor-default"
      onMouseMove={onMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
    >
      {/* Left: Original Photo */}
      <div
        className="relative overflow-hidden bg-muted flex-shrink-0"
        style={{ width: `${splitPct}%` }}
      >
        <div className="absolute top-2 left-2 z-10 rounded bg-black/60 px-2 py-1 text-xs text-white font-medium pointer-events-none">
          {t("comparison.original")}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Original facade"
          className="h-full w-full object-contain"
          draggable={false}
        />
      </div>

      {/* Draggable divider */}
      <div
        className="relative z-20 w-1.5 cursor-col-resize bg-primary/50 hover:bg-primary transition-colors flex-shrink-0 flex items-center justify-center"
        onMouseDown={onMouseDown}
      >
        <div className="rounded-full bg-primary/90 px-1 py-4 flex flex-col items-center gap-1 shadow">
          <span className="block w-0.5 h-4 rounded-full bg-white/80" />
          <span className="block w-0.5 h-4 rounded-full bg-white/80" />
        </div>
      </div>

      {/* Right: DXF Viewer */}
      <div className="relative flex-1 overflow-hidden min-w-0">
        <div className="absolute top-2 left-2 z-10 rounded bg-black/60 px-2 py-1 text-xs text-white font-medium pointer-events-none">
          {t("comparison.dxf")}
        </div>
        <ErrorBoundary dxfUrl={dxfUrl}>
          <DxfViewer dxfUrl={dxfUrl} />
        </ErrorBoundary>
      </div>
    </div>
  );
}
