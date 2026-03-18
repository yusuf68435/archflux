"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DxfViewer } from "./dxf-viewer";
import { ComparisonView } from "./comparison-view";
import { ScaleCalibration } from "./scale-calibration";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useRequestRefund } from "@/hooks/use-job";

type ViewMode = "interactive" | "static" | "comparison";

interface DxfPreviewProps {
  dxfUrl: string;
  previewUrl: string;
  imageUrl?: string;
  jobId?: string;
  onNewConversion: () => void;
  onContinueToCoding?: () => void;
}

export function DxfPreview({ dxfUrl, previewUrl, imageUrl, jobId, onNewConversion, onContinueToCoding }: DxfPreviewProps) {
  const t = useTranslations("converter");
  const [viewMode, setViewMode] = useState<ViewMode>("interactive");
  const [showScale, setShowScale] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundDone, setRefundDone] = useState(false);
  const requestRefund = useRequestRefund();

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = dxfUrl;
    a.download = "facade.dxf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRefundSubmit = async () => {
    if (!jobId || !refundReason.trim()) return;
    try {
      await requestRefund.mutateAsync({ jobId, reason: refundReason.trim() });
      toast.success(t("refundSuccess"));
      setRefundOpen(false);
      setRefundDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("refundError"));
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t("completed")}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{t("completedDesc")}</p>
          </div>
          <Badge variant="default" className="bg-green-500">{t("success")}</Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* View mode tabs */}
          {dxfUrl && (
            <div className="flex gap-2 text-sm flex-wrap">
              <button
                onClick={() => setViewMode("interactive")}
                className={`px-3 py-1 rounded-md transition-colors ${
                  viewMode === "interactive" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {t("viewer.interactive")}
              </button>
              {previewUrl && (
                <button
                  onClick={() => setViewMode("static")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    viewMode === "static" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {t("viewer.static")}
                </button>
              )}
              {imageUrl && (
                <button
                  onClick={() => setViewMode("comparison")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    viewMode === "comparison" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {t("comparison.tab")}
                </button>
              )}
            </div>
          )}

          {/* Interactive DXF Viewer */}
          {viewMode === "interactive" && dxfUrl && (
            <ErrorBoundary dxfUrl={dxfUrl}>
              <DxfViewer dxfUrl={dxfUrl} />
            </ErrorBoundary>
          )}

          {/* Static PNG Preview */}
          {viewMode === "static" && previewUrl && (
            <div className="rounded-lg border overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt={t("dxfPreview")} className="w-full" />
            </div>
          )}

          {/* Side-by-side comparison */}
          {viewMode === "comparison" && imageUrl && dxfUrl && (
            <ComparisonView imageUrl={imageUrl} dxfUrl={dxfUrl} />
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

          <div className="flex gap-3 flex-wrap">
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
            {/* Scale calibration toggle */}
            {jobId && imageUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowScale((v) => !v)}
                className="text-muted-foreground text-xs"
              >
                {showScale ? t("scale.hide") : t("scale.show")}
              </Button>
            )}
            {/* Refund button — only shown when jobId provided */}
            {jobId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRefundOpen(true)}
                disabled={refundDone}
                className="text-muted-foreground hover:text-destructive text-xs"
              >
                {refundDone ? t("refundAlreadyRequested") : t("requestRefund")}
              </Button>
            )}
          </div>
          {/* Scale calibration panel */}
          {showScale && jobId && imageUrl && (
            <div className="rounded-lg border p-4 space-y-2">
              <div>
                <p className="font-medium text-sm">{t("scale.title")}</p>
                <p className="text-xs text-muted-foreground">{t("scale.desc")}</p>
              </div>
              <ScaleCalibration imageUrl={imageUrl} jobId={jobId} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refund Dialog */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("refundDialogTitle")}</DialogTitle>
            <DialogDescription>{t("refundDialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>{t("refundReasonLabel")}</Label>
            <Textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder={t("refundReasonPlaceholder")}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">{refundReason.length}/500</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setRefundOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleRefundSubmit}
              disabled={!refundReason.trim() || requestRefund.isPending}
            >
              {requestRefund.isPending ? t("refundSubmitting") : t("refundSubmit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
