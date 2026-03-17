"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DxfViewer } from "./dxf-viewer";

interface DxfPreviewProps {
  dxfUrl: string;
  previewUrl: string;
  onNewConversion: () => void;
  onContinueToCoding?: () => void;
}

export function DxfPreview({ dxfUrl, previewUrl, onNewConversion, onContinueToCoding }: DxfPreviewProps) {
  const t = useTranslations("converter");
  const [showViewer, setShowViewer] = useState(true);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = dxfUrl;
    a.download = "facade.dxf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{t("completed")}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{t("completedDesc")}</p>
        </div>
        <Badge variant="default" className="bg-green-500">{t("success")}</Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle between interactive viewer and static preview */}
        {dxfUrl && (
          <div className="flex gap-2 text-sm">
            <button
              onClick={() => setShowViewer(true)}
              className={`px-3 py-1 rounded-md transition-colors ${
                showViewer ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {t("viewer.interactive")}
            </button>
            {previewUrl && (
              <button
                onClick={() => setShowViewer(false)}
                className={`px-3 py-1 rounded-md transition-colors ${
                  !showViewer ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {t("viewer.static")}
              </button>
            )}
          </div>
        )}

        {/* Interactive DXF Viewer */}
        {showViewer && dxfUrl && <DxfViewer dxfUrl={dxfUrl} />}

        {/* Static PNG Preview (fallback) */}
        {!showViewer && previewUrl && (
          <div className="rounded-lg border overflow-hidden bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt={t("dxfPreview")} className="w-full" />
          </div>
        )}

        {/* No preview available at all */}
        {!dxfUrl && !previewUrl && (
          <div className="flex items-center justify-center rounded-lg border bg-muted h-64">
            <div className="text-center text-muted-foreground">
              <svg className="mx-auto h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>{t("dxfGenerated")}</p>
              <p className="text-xs">{t("dxfOpenInCAD")}</p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {onContinueToCoding && (
            <Button onClick={onContinueToCoding} className="flex-1">
              {t("coding.continueToCoding")}
            </Button>
          )}
          <Button
            variant={onContinueToCoding ? "outline" : "default"}
            onClick={handleDownload}
            className="flex-1"
            disabled={!dxfUrl}
          >
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {t("downloadDxf")}
          </Button>
          <Button variant="outline" onClick={onNewConversion} className="flex-1">
            {t("newConversion")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
