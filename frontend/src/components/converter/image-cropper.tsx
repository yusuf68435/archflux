"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ImageCropperProps {
  imageUrl: string;
  onCropComplete: (region: { x: number; y: number; width: number; height: number }) => void;
  onSkip: () => void;
}

export function ImageCropper({
  imageUrl,
  onCropComplete,
  onSkip,
}: ImageCropperProps) {
  const t = useTranslations("converter");
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getRelativeCoords = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const coords = getRelativeCoords(e);
      setCropStart(coords);
      setCropEnd(coords);
      setIsDragging(true);
    },
    [getRelativeCoords]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setCropEnd(getRelativeCoords(e));
    },
    [isDragging, getRelativeCoords]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleCrop = useCallback(() => {
    if (!cropStart || !cropEnd) return;
    const region = {
      x: Math.min(cropStart.x, cropEnd.x),
      y: Math.min(cropStart.y, cropEnd.y),
      width: Math.abs(cropEnd.x - cropStart.x),
      height: Math.abs(cropEnd.y - cropStart.y),
    };
    onCropComplete(region);
  }, [cropStart, cropEnd, onCropComplete]);

  const cropRect = cropStart && cropEnd
    ? {
        left: `${Math.min(cropStart.x, cropEnd.x) * 100}%`,
        top: `${Math.min(cropStart.y, cropEnd.y) * 100}%`,
        width: `${Math.abs(cropEnd.x - cropStart.x) * 100}%`,
        height: `${Math.abs(cropEnd.y - cropStart.y) * 100}%`,
      }
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("cropTitle")} ({t("cropDesc")})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          ref={containerRef}
          className="relative cursor-crosshair overflow-hidden rounded-lg border"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt={t("preview")}
            className="w-full select-none"
            draggable={false}
          />

          {/* Crop overlay */}
          {cropRect && (
            <>
              {/* Darken outside crop area */}
              <div className="absolute inset-0 bg-black/40 pointer-events-none" />
              {/* Clear crop area */}
              <div
                className="absolute border-2 border-primary bg-transparent pointer-events-none"
                style={cropRect}
              >
                <div className="absolute inset-0 bg-black/0" />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onSkip}>
            {t("skipCrop")}
          </Button>
          <Button
            onClick={handleCrop}
            disabled={!cropRect}
          >
            {t("cropAndContinue")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
