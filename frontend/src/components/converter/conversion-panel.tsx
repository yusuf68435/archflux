"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useConverterStore } from "@/stores/converter-store";
import { useCreateJob } from "@/hooks/use-job";
import type { JobType } from "@/types/job";

interface ConversionPanelProps {
  onJobStarted: (jobId: string) => void;
  onBack: () => void;
}

const JOB_COSTS: Record<string, number> = {
  FULL_CONVERSION: 2,
  PARTIAL_SPLIT: 3,
  DETAIL_EXTRACTION: 1,
};

export function ConversionPanel({ onJobStarted, onBack }: ConversionPanelProps) {
  const t = useTranslations("converter");
  const {
    uploadedUrl,
    localPreviewUrl,
    cropRegion,
    jobType,
    setJobType,
    splitDirection,
    setSplitDirection,
    splitRows,
    setSplitRows,
    autoCoding,
    setAutoCoding,
  } = useConverterStore();

  const createJob = useCreateJob();

  const handleSubmit = async () => {
    if (!uploadedUrl) return;

    try {
      const payload: Record<string, unknown> = {
        type: jobType,
        inputImageUrl: uploadedUrl,
      };

      if (cropRegion) payload.cropRegion = cropRegion;
      if (jobType === "PARTIAL_SPLIT") {
        payload.splitConfig = { direction: splitDirection, parts: splitRows };
      }
      if (autoCoding) payload.autoCoding = true;

      const result = await createJob.mutateAsync(payload as any);
      toast.success(t("conversionStarted"));
      onJobStarted(result.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("conversionError"));
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>{t("preview")}</CardTitle>
        </CardHeader>
        <CardContent>
          {localPreviewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={localPreviewUrl}
              alt={t("preview")}
              className="w-full rounded-lg"
            />
          )}
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t("configTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>{t("jobTypeLabel")}</Label>
            <Select value={jobType} onValueChange={(v) => v && setJobType(v as JobType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL_CONVERSION">
                  {t("jobType.fullConversion")} (2 {t("credits")})
                </SelectItem>
                <SelectItem value="PARTIAL_SPLIT">
                  {t("jobType.partialSplit")} (3 {t("credits")})
                </SelectItem>
                <SelectItem value="DETAIL_EXTRACTION">
                  {t("jobType.detailExtraction")} (1 {t("credits")})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {jobType === "PARTIAL_SPLIT" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("splitDirection.label")}</Label>
                <Select value={splitDirection} onValueChange={(v) => v && setSplitDirection(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="horizontal">{t("splitDirection.horizontal")}</SelectItem>
                    <SelectItem value="vertical">{t("splitDirection.vertical")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("splitParts")}</Label>
                <Select value={String(splitRows)} onValueChange={(v) => v && setSplitRows(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label>{t("autoCodingToggle")}</Label>
              <p className="text-sm text-muted-foreground">{t("autoCodingDesc")}</p>
            </div>
            <Switch checked={autoCoding} onCheckedChange={setAutoCoding} />
          </div>

          <div className="rounded-lg bg-muted p-4">
            <div className="flex justify-between text-sm">
              <span>{t("costSummary")}:</span>
              <span className="font-medium">
                {(JOB_COSTS[jobType] || 2) + (autoCoding ? 1 : 0)} {t("credits")}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack} className="flex-1">
              {t("back")}
            </Button>
            <Button onClick={handleSubmit} disabled={createJob.isPending} className="flex-1">
              {createJob.isPending ? t("starting") : t("startConversion")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
