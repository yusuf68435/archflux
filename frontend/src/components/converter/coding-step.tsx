"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodingModeSelector } from "./coding-mode-selector";
import { ManualCodingEditor } from "./manual-coding-editor";
import { DxfViewer } from "./dxf-viewer";
import { JobProgress } from "./job-progress";
import { useConverterStore } from "@/stores/converter-store";
import { useApplyCoding, useJobStatus } from "@/hooks/use-job";

interface CodingStepProps {
  dxfUrl: string;
  imageUrl: string;
  imageHeight: number;
  jobId: string;
  onComplete: (dxfUrl: string, previewUrl: string) => void;
  onSkip: () => void;
}

export function CodingStep({
  dxfUrl,
  imageUrl,
  imageHeight,
  jobId,
  onComplete,
  onSkip,
}: CodingStepProps) {
  const t = useTranslations("converter.coding");
  const applyCoding = useApplyCoding();
  const { codingMode, setCodingMode, codingConfig, codedDxfUrl, codedPreviewUrl, setCodedResult } =
    useConverterStore();
  const [codingTaskId, setCodingTaskId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleModeSelect = useCallback(
    (mode: "auto" | "manual" | "skip") => {
      setCodingMode(mode);

      if (mode === "skip") {
        onSkip();
        return;
      }

      if (mode === "auto") {
        // Directly submit auto coding
        setIsProcessing(true);
        applyCoding.mutate(
          {
            jobId,
            dxfUrl,
            imageUrl,
            imageHeight,
            mode: "auto",
          },
          {
            onSuccess: (data) => {
              setCodingTaskId(data.taskId);
            },
            onError: (error) => {
              toast.error(error.message || t("codingError"));
              setIsProcessing(false);
            },
          }
        );
      }
    },
    [setCodingMode, onSkip, applyCoding, jobId, dxfUrl, imageUrl, imageHeight, t]
  );

  const handleManualApply = useCallback(() => {
    setIsProcessing(true);
    applyCoding.mutate(
      {
        jobId,
        dxfUrl,
        imageUrl,
        imageHeight,
        mode: "manual",
        codingConfig,
      },
      {
        onSuccess: (data) => {
          setCodingTaskId(data.taskId);
        },
        onError: (error) => {
          toast.error(error.message || t("codingError"));
          setIsProcessing(false);
        },
      }
    );
  }, [applyCoding, jobId, dxfUrl, imageUrl, imageHeight, codingConfig, t]);

  const handleCodingComplete = useCallback(
    (completedDxfUrl: string, previewUrl: string) => {
      setCodedResult(completedDxfUrl, previewUrl);
      setIsProcessing(false);
      setCodingTaskId(null);
      toast.success(t("codingComplete"));
      onComplete(completedDxfUrl, previewUrl);
    },
    [setCodedResult, onComplete, t]
  );

  // Show progress if coding is being processed
  if (codingTaskId && isProcessing) {
    return (
      <JobProgress
        jobId={jobId}
        onComplete={handleCodingComplete}
      />
    );
  }

  // Show coded result
  if (codedDxfUrl) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("codingComplete")}</CardTitle>
          <Badge className="bg-green-500">{t("codingComplete")}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <DxfViewer dxfUrl={codedDxfUrl} />
          <div className="flex gap-3">
            <Button
              onClick={() => {
                const a = document.createElement("a");
                a.href = codedDxfUrl;
                a.download = "facade_coded.dxf";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
              className="flex-1"
            >
              {t("apply")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mode not yet selected
  if (!codingMode || codingMode === "skip") {
    return <CodingModeSelector onSelect={handleModeSelect} />;
  }

  // Manual coding editor
  if (codingMode === "manual") {
    return (
      <ManualCodingEditor
        dxfUrl={dxfUrl}
        onApply={handleManualApply}
        onCancel={() => setCodingMode(null)}
        isApplying={isProcessing}
      />
    );
  }

  // Auto coding (should not reach here normally - auto triggers immediately)
  return <CodingModeSelector onSelect={handleModeSelect} />;
}
