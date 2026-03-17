/**
 * Client for the FastAPI AI backend service.
 * Only used server-side (Next.js API routes / Server Actions).
 */

const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_SERVICE_API_KEY =
  process.env.AI_SERVICE_API_KEY || "change-me-in-production";

async function aiRequest(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${AI_SERVICE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": AI_SERVICE_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI Service error (${response.status}): ${error}`);
  }

  return response.json();
}

export async function requestFullConversion(
  jobId: string,
  imageUrl: string,
  cropRegion?: { x: number; y: number; width: number; height: number }
) {
  return aiRequest("/process/full-conversion", {
    job_id: jobId,
    image_url: imageUrl,
    crop_region: cropRegion || null,
  });
}

export async function requestPartialSplit(
  jobId: string,
  imageUrl: string,
  splitConfig: { direction: string; parts: number }
) {
  return aiRequest("/process/partial-split", {
    job_id: jobId,
    image_url: imageUrl,
    split_config: splitConfig,
  });
}

export async function requestDetailExtraction(
  jobId: string,
  imageUrl: string,
  detailRegion: { x: number; y: number; width: number; height: number }
) {
  return aiRequest("/process/detail-extraction", {
    job_id: jobId,
    image_url: imageUrl,
    detail_region: detailRegion,
  });
}

export async function requestAutoCoding(
  jobId: string,
  dxfUrl: string,
  imageUrl: string,
  imageHeight: number
) {
  return aiRequest("/process/auto-coding", {
    job_id: jobId,
    dxf_url: dxfUrl,
    image_url: imageUrl,
    image_height: imageHeight,
  });
}

export async function requestManualCoding(
  jobId: string,
  dxfUrl: string,
  codingConfig: Record<string, unknown>,
  imageHeight: number
) {
  return aiRequest("/process/manual-coding", {
    job_id: jobId,
    dxf_url: dxfUrl,
    coding_config: codingConfig,
    image_height: imageHeight,
  });
}

export async function getTaskStatus(taskId: string) {
  const response = await fetch(`${AI_SERVICE_URL}/tasks/${taskId}`, {
    headers: {
      "X-API-Key": AI_SERVICE_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get task status: ${response.status}`);
  }

  return response.json();
}
