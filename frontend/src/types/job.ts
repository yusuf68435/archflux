export type JobType =
  | "FULL_CONVERSION"
  | "PARTIAL_SPLIT"
  | "DETAIL_EXTRACTION"
  | "AUTO_CODING";

export type JobStatus =
  | "PENDING"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface Job {
  id: string;
  userId: string;
  type: JobType;
  status: JobStatus;
  creditsCost: number;
  inputImageUrl: string;
  inputImageMeta?: {
    width: number;
    height: number;
    format: string;
    fileSize: number;
  };
  cropRegion?: { x: number; y: number; width: number; height: number };
  splitConfig?: { direction: string; parts: number };
  detailRegion?: { x: number; y: number; width: number; height: number };
  codingConfig?: CodingConfig;
  outputDxfUrl?: string;
  outputPreviewUrl?: string;
  outputMeta?: {
    layers: string[];
    entityCount: number;
    processingTime: number;
  };
  celeryTaskId?: string;
  progress: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface CodingConfig {
  innerAxes: Array<{ x: number; label: string }>;
  outerAxes: Array<{ y: number; label: string }>;
  texts: Array<{
    x: number;
    y: number;
    value: string;
    fontSize?: number;
  }>;
}
