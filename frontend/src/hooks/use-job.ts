import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Job, JobType } from "@/types/job";

// ---------- Types ----------

interface CreateJobPayload {
  type: JobType;
  inputImageUrl: string;
  cropRegion?: { x: number; y: number; width: number; height: number };
  splitConfig?: { direction: string; parts: number };
  autoCoding?: boolean;
}

interface JobListResponse {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------- API helpers ----------

async function fetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// ---------- Hooks ----------

/**
 * Mutation to create a new conversion job.
 */
export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateJobPayload) =>
      fetchJson<Job>("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

/**
 * Query that polls a job's status every 2 seconds while it is PENDING or PROCESSING.
 */
export function useJobStatus(jobId: string | null) {
  return useQuery<Job>({
    queryKey: ["job", jobId],
    queryFn: () => fetchJson<Job>(`/api/jobs/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "PENDING" || status === "QUEUED" || status === "PROCESSING") {
        return 2000;
      }
      return false;
    },
  });
}

interface ApplyCodingPayload {
  jobId: string;
  dxfUrl: string;
  imageUrl: string;
  imageHeight: number;
  mode: "auto" | "manual";
  codingConfig?: {
    innerAxes: Array<{ x: number; label: string }>;
    outerAxes: Array<{ y: number; label: string }>;
    texts: Array<{ x: number; y: number; value: string; fontSize?: number }>;
  };
}

/**
 * Mutation to apply coding (auto or manual) to a completed job's DXF.
 */
export function useApplyCoding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ApplyCodingPayload) =>
      fetchJson<{ taskId: string }>("/api/coding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["job", variables.jobId] });
    },
  });
}

/**
 * Paginated query for the user's job history.
 */
export function useJobHistory(page: number = 1) {
  return useQuery<JobListResponse>({
    queryKey: ["jobs", page],
    queryFn: () =>
      fetchJson<JobListResponse>(`/api/jobs?page=${page}`),
  });
}
