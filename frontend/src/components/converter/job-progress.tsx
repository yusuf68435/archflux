"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useJobStatus, useCancelJob } from "@/hooks/use-job";

interface JobProgressProps {
  jobId: string;
  onComplete: (dxfUrl: string, previewUrl: string, imageHeight?: number) => void;
  onCancel?: () => void;
}

export function JobProgress({ jobId, onComplete, onCancel }: JobProgressProps) {
  const t = useTranslations("converter");
  const { data: job, error } = useJobStatus(jobId);
  const cancelJob = useCancelJob();
  const [showCancel, setShowCancel] = useState(false);

  // Show cancel button after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowCancel(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleCancel = async () => {
    try {
      await cancelJob.mutateAsync(jobId);
      toast.info(t("cancelled"));
      onCancel?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("cancelError"));
    }
  };

  const stageLabels: Record<string, string> = {
    downloading_image: t("stages.downloading"),
    preprocessing: t("stages.preprocessing"),
    preprocessing_complete: t("stages.preprocessing"),
    detecting_elements: t("stages.detection"),
    detection_complete: t("stages.detection"),
    segmenting_elements: t("stages.segmentation"),
    segmentation_complete: t("stages.segmentation"),
    vectorizing: t("stages.vectorization"),
    vectorization_complete: t("stages.vectorization"),
    regularizing: t("stages.regularization"),
    regularization_complete: t("stages.regularization"),
    generating_dxf: t("stages.dxfGeneration"),
    generating_preview: t("stages.dxfGeneration"),
    uploading_results: t("stages.uploading"),
    complete: t("completed"),
  };

  useEffect(() => {
    if (job?.status === "COMPLETED") {
      const meta = (job as any).outputMeta;
      const imageHeight = meta?.image_height || meta?.imageHeight;
      onComplete(job.outputDxfUrl || "", job.outputPreviewUrl || "", imageHeight);
    }
    if (job?.status === "FAILED") {
      toast.error(job.errorMessage || t("failed"));
    }
  }, [job?.status, job?.outputDxfUrl, job?.outputPreviewUrl, job?.errorMessage, onComplete, t]);

  const progress = job?.progress || 0;
  const stageName = (job as any)?.stage;
  const stageText = stageName ? (stageLabels[stageName] || stageName) : t("stages.preprocessing");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("processing")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="relative">
            <div className="h-20 w-20 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <svg
              className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <div className="w-full max-w-md space-y-2">
            <Progress value={progress} className="h-3" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{stageText}</span>
              <span>%{progress}</span>
            </div>
          </div>

          {(error || job?.status === "FAILED") && (
            <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
              {job?.errorMessage || t("failed")}
            </div>
          )}

          {showCancel && job?.status !== "COMPLETED" && job?.status !== "FAILED" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={cancelJob.isPending}
              className="text-muted-foreground hover:text-destructive hover:border-destructive"
            >
              {cancelJob.isPending ? t("cancelling") : t("cancel")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
