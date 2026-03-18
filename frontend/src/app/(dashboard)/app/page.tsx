"use client";

import { useTranslations } from "next-intl";
import { useConverterStore } from "@/stores/converter-store";
import { ImageUpload } from "@/components/converter/image-upload";
import { ImageCropper } from "@/components/converter/image-cropper";
import { ConversionPanel } from "@/components/converter/conversion-panel";
import { JobProgress } from "@/components/converter/job-progress";
import { DxfPreview } from "@/components/converter/dxf-preview";
import { CodingStep } from "@/components/converter/coding-step";

export default function ConverterPage() {
  const t = useTranslations("converter");
  const {
    step, setStep,
    localPreviewUrl,
    activeJobId,
    uploadedUrl,
    resultDxfUrl, resultPreviewUrl, resultImageHeight,
    setUploadedFile, setUploadedUrl, setLocalPreviewUrl,
    setCropRegion, setActiveJobId, setResult, setCodedResult, reset,
  } = useConverterStore();

  const steps = [
    t("steps.upload"),
    t("steps.crop"),
    t("steps.configure"),
    t("steps.processing"),
    t("steps.result"),
    t("steps.coding"),
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm flex-wrap">
        {steps.map((label, i) => {
          const isActive = step >= i;
          return (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && (
                <div className={`h-px w-8 ${isActive ? "bg-primary" : "bg-muted"}`} />
              )}
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                  isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              <span className={isActive ? "font-medium" : "text-muted-foreground"}>{label}</span>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {step === 0 && (
        <ImageUpload
          onUploaded={(file, fileUrl) => {
            setUploadedFile(file);
            setUploadedUrl(fileUrl);
            setLocalPreviewUrl(URL.createObjectURL(file));
            setStep(1);
          }}
        />
      )}
      {step === 1 && localPreviewUrl && (
        <ImageCropper
          imageUrl={localPreviewUrl}
          onCropComplete={(region) => {
            setCropRegion(region);
            setStep(2);
          }}
          onSkip={() => {
            setCropRegion(null);
            setStep(2);
          }}
        />
      )}
      {step === 2 && (
        <ConversionPanel
          onJobStarted={(id) => {
            setActiveJobId(id);
            setStep(3);
          }}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && activeJobId && (
        <JobProgress
          jobId={activeJobId}
          onComplete={(dxfUrl, previewUrl, imageHeight) => {
            setResult(dxfUrl, previewUrl, imageHeight);
            setStep(4);
          }}
        />
      )}
      {step === 4 && (
        <DxfPreview
          dxfUrl={resultDxfUrl || ""}
          previewUrl={resultPreviewUrl || ""}
          imageUrl={uploadedUrl || localPreviewUrl || undefined}
          jobId={activeJobId || undefined}
          onNewConversion={reset}
          onContinueToCoding={() => setStep(5)}
        />
      )}
      {step === 5 && resultDxfUrl && activeJobId && (
        <CodingStep
          dxfUrl={resultDxfUrl}
          imageUrl={uploadedUrl || ""}
          imageHeight={resultImageHeight || 1000}
          jobId={activeJobId}
          onComplete={(codedDxfUrl, codedPreviewUrl) => {
            setCodedResult(codedDxfUrl, codedPreviewUrl);
            setResult(codedDxfUrl, codedPreviewUrl, resultImageHeight);
            setStep(4);
          }}
          onSkip={() => setStep(4)}
        />
      )}
    </div>
  );
}
