import { useState, useCallback } from "react";

interface PresignedResponse {
  uploadUrl: string;
  fileUrl: string;
  key: string;
}

export interface UploadResult {
  key: string;
  fileUrl: string;
}

interface UseUploadReturn {
  upload: (file: File) => Promise<UploadResult>;
  isUploading: boolean;
  progress: number;
  error: string | null;
}

export function useUpload(): UseUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File): Promise<UploadResult> => {
    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Step 1: Get presigned URL from the API
      const presignedRes = await fetch("/api/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      });

      if (!presignedRes.ok) {
        const body = await presignedRes.json().catch(() => null);
        throw new Error(
          body?.message ?? `Failed to get presigned URL (${presignedRes.status})`
        );
      }

      const { uploadUrl, fileUrl, key } = (await presignedRes.json()) as PresignedResponse;
      setProgress(20);

      // Step 2: Upload the file to S3 via presigned URL
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const uploadProgress = 20 + (e.loaded / e.total) * 75;
            setProgress(Math.round(uploadProgress));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Network error during upload"));
        });

        xhr.addEventListener("abort", () => {
          reject(new Error("Upload was aborted"));
        });

        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      setProgress(100);

      return { key, fileUrl };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unknown error occurred";
      setError(message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { upload, isUploading, progress, error };
}
