"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Point { x: number; y: number }

interface ScaleCalibrationProps {
  imageUrl: string;
  jobId: string;
}

const PRESETS = [
  { labelKey: "scale.presetFloor", meters: 3.0 },
  { labelKey: "scale.presetDoor", meters: 2.1 },
  { labelKey: "scale.presetWindow", meters: 1.2 },
];

export function ScaleCalibration({ imageUrl, jobId }: ScaleCalibrationProps) {
  const t = useTranslations("converter");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [ptA, setPtA] = useState<Point | null>(null);
  const [ptB, setPtB] = useState<Point | null>(null);
  const [meters, setMeters] = useState("");
  const [savedScale, setSavedScale] = useState<{ pixels: number; meters: number } | null>(null);
  const [saving, setSaving] = useState(false);

  // Draw image + line + points on canvas
  const redraw = useCallback((a: Point | null, b: Point | null) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (a) {
      ctx.beginPath();
      ctx.arc(a.x, a.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("A", a.x + 9, a.y - 5);
    }
    if (b) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#3b82f6";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("B", b.x + 9, b.y - 5);
    }
    if (a && b) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, []);

  // Load image into canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const maxW = canvas.parentElement?.clientWidth || 600;
      const scale = Math.min(maxW / img.naturalWidth, 380 / img.naturalHeight, 1);
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      redraw(ptA, ptB);
    };
    img.src = imageUrl;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  useEffect(() => {
    redraw(ptA, ptB);
  }, [ptA, ptB, redraw]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!ptA || (ptA && ptB)) {
      setPtA({ x, y });
      setPtB(null);
    } else {
      setPtB({ x, y });
    }
  };

  const pixelDist = ptA && ptB
    ? Math.sqrt((ptB.x - ptA.x) ** 2 + (ptB.y - ptA.y) ** 2)
    : null;

  const metersNum = parseFloat(meters);
  const pixelsPerMeter = pixelDist && metersNum > 0 ? pixelDist / metersNum : null;

  const handleSave = async () => {
    if (!pixelDist || !metersNum) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scaleRef: { pixels: Math.round(pixelDist), meters: metersNum } }),
      });
      if (!res.ok) throw new Error();
      setSavedScale({ pixels: Math.round(pixelDist), meters: metersNum });
      toast.success(t("scale.saved"));
    } catch {
      toast.error(t("scale.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPtA(null);
    setPtB(null);
    setMeters("");
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (canvas && img) {
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">
          {!ptA
            ? t("scale.step1")
            : !ptB
            ? t("scale.step2")
            : t("scale.step3")}
        </p>
      </div>

      {/* Canvas */}
      <div className="rounded-lg border overflow-hidden bg-muted">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="cursor-crosshair block"
          style={{ maxWidth: "100%" }}
        />
      </div>

      {/* Measurement input */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[160px] space-y-1">
          <Label>{t("scale.distance")}</Label>
          <div className="relative">
            <Input
              type="number"
              min="0.1"
              step="0.1"
              value={meters}
              onChange={(e) => setMeters(e.target.value)}
              placeholder="3.0"
              className="pr-10"
              disabled={!ptB}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">m</span>
          </div>
        </div>

        {/* Presets */}
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <Button
              key={p.labelKey}
              variant="outline"
              size="sm"
              onClick={() => setMeters(String(p.meters))}
              disabled={!ptB}
            >
              {t(p.labelKey)}
            </Button>
          ))}
        </div>
      </div>

      {/* Result info */}
      {pixelsPerMeter && (
        <div className="rounded-lg bg-muted/60 border p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("scale.pixelDist")}</span>
            <span className="font-mono">{Math.round(pixelDist!)} px</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("scale.pixelsPerMeter")}</span>
            <span className="font-mono">{pixelsPerMeter.toFixed(1)} px/m</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("scale.mmPerPixel")}</span>
            <span className="font-mono">{(1000 / pixelsPerMeter).toFixed(2)} mm/px</span>
          </div>
        </div>
      )}

      {savedScale && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-sm text-green-700 dark:text-green-400">
          {t("scale.savedInfo", { pixels: savedScale.pixels, meters: savedScale.meters })}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={!pixelsPerMeter || saving}
          size="sm"
        >
          {saving ? t("scale.saving") : t("scale.save")}
        </Button>
        <Button variant="outline" size="sm" onClick={handleReset}>
          {t("scale.reset")}
        </Button>
      </div>
    </div>
  );
}
