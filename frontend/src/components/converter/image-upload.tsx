"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useUpload } from "@/hooks/use-upload";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface ImageUploadProps {
  onUploaded: (file: File, url: string) => void;
}

export function ImageUpload({ onUploaded }: ImageUploadProps) {
  const t = useTranslations("converter");
  const [isDragging, setIsDragging] = useState(false);
  const { upload, isUploading, progress, error } = useUpload();

  const handleFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(t("supportedFormats", { formats: "JPG, PNG, WebP" }));
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(t("maxSize", { size: "50MB" }));
        return;
      }
      try {
        const { fileUrl } = await upload(file);
        toast.success(t("uploadSuccess"));
        onUploaded(file, fileUrl);
      } catch {
        // error is already in the hook state
      }
    },
    [upload, onUploaded, t]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <Card>
      <CardContent className="p-6">
        <div
          className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <svg
            className="mb-4 h-12 w-12 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>

          <p className="mb-2 text-lg font-medium">{t("dragDrop")}</p>
          <p className="mb-4 text-sm text-muted-foreground">
            {t("supportedFormats", { formats: "JPG, PNG, WebP" })} - {t("maxSize", { size: "50MB" })}
          </p>

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleInputChange}
            className="absolute inset-0 cursor-pointer opacity-0"
            disabled={isUploading}
          />

          {!isUploading && (
            <Button variant="outline" className="pointer-events-none">
              {t("browseFiles")}
            </Button>
          )}

          {isUploading && (
            <div className="w-full max-w-xs space-y-2">
              <Progress value={progress} />
              <p className="text-center text-sm text-muted-foreground">
                %{progress}
              </p>
            </div>
          )}

          {error && (
            <p className="mt-2 text-sm text-destructive">{error}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
