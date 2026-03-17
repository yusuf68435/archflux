import { create } from "zustand";
import type { JobType, CodingConfig } from "@/types/job";

interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

type SplitDirection = "horizontal" | "vertical";
type CodingMode = "auto" | "manual" | "skip" | null;
type CodingTool = "innerAxis" | "outerAxis" | "text" | "select" | null;

interface ConverterState {
  // Step tracking (0-5): upload, crop, configure, processing, result, coding
  step: number;
  setStep: (step: number) => void;

  // Upload
  uploadedFile: File | null;
  uploadedUrl: string | null;
  localPreviewUrl: string | null;
  setUploadedFile: (file: File | null) => void;
  setUploadedUrl: (url: string | null) => void;
  setLocalPreviewUrl: (url: string | null) => void;

  // Crop region (relative coordinates 0-1)
  cropRegion: CropRegion | null;
  setCropRegion: (region: CropRegion | null) => void;

  // Job config
  jobType: JobType;
  setJobType: (type: JobType) => void;
  splitDirection: SplitDirection;
  setSplitDirection: (dir: SplitDirection) => void;
  splitRows: number;
  setSplitRows: (n: number) => void;
  splitCols: number;
  setSplitCols: (n: number) => void;
  autoCoding: boolean;
  setAutoCoding: (v: boolean) => void;

  // Active job
  activeJobId: string | null;
  setActiveJobId: (id: string | null) => void;

  // Result
  resultDxfUrl: string | null;
  resultPreviewUrl: string | null;
  resultImageHeight: number | null;
  setResult: (dxfUrl: string | null, previewUrl: string | null, imageHeight?: number | null) => void;

  // Coding (Step 5)
  codingMode: CodingMode;
  setCodingMode: (mode: CodingMode) => void;
  codingTool: CodingTool;
  setCodingTool: (tool: CodingTool) => void;
  codingConfig: CodingConfig;
  setCodingConfig: (config: CodingConfig) => void;
  addInnerAxis: (x: number, label: string) => void;
  removeInnerAxis: (index: number) => void;
  updateInnerAxisLabel: (index: number, label: string) => void;
  addOuterAxis: (y: number, label: string) => void;
  removeOuterAxis: (index: number) => void;
  updateOuterAxisLabel: (index: number, label: string) => void;
  addText: (x: number, y: number, value: string) => void;
  removeText: (index: number) => void;
  updateText: (index: number, updates: Partial<CodingConfig["texts"][0]>) => void;
  codedDxfUrl: string | null;
  codedPreviewUrl: string | null;
  setCodedResult: (dxfUrl: string | null, previewUrl: string | null) => void;

  // Reset
  reset: () => void;
}

const emptyCodingConfig: CodingConfig = {
  innerAxes: [],
  outerAxes: [],
  texts: [],
};

const initialState = {
  step: 0,
  uploadedFile: null as File | null,
  uploadedUrl: null as string | null,
  localPreviewUrl: null as string | null,
  cropRegion: null as CropRegion | null,
  jobType: "FULL_CONVERSION" as JobType,
  splitDirection: "horizontal" as SplitDirection,
  splitRows: 2,
  splitCols: 2,
  autoCoding: false,
  activeJobId: null as string | null,
  resultDxfUrl: null as string | null,
  resultPreviewUrl: null as string | null,
  resultImageHeight: null as number | null,
  codingMode: null as CodingMode,
  codingTool: null as CodingTool,
  codingConfig: { ...emptyCodingConfig },
  codedDxfUrl: null as string | null,
  codedPreviewUrl: null as string | null,
};

function nextInnerAxisLabel(existing: CodingConfig["innerAxes"]): string {
  const i = existing.length;
  if (i < 26) return String.fromCharCode(65 + i);
  return String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
}

function nextOuterAxisLabel(existing: CodingConfig["outerAxes"]): string {
  return String(existing.length + 1);
}

export const useConverterStore = create<ConverterState>()((set, get) => ({
  ...initialState,

  setStep: (step) => set({ step }),

  setUploadedFile: (file) => set({ uploadedFile: file }),
  setUploadedUrl: (url) => set({ uploadedUrl: url }),
  setLocalPreviewUrl: (url) => set({ localPreviewUrl: url }),

  setCropRegion: (region) => set({ cropRegion: region }),

  setJobType: (type) => set({ jobType: type }),
  setSplitDirection: (dir) => set({ splitDirection: dir }),
  setSplitRows: (n) => set({ splitRows: n }),
  setSplitCols: (n) => set({ splitCols: n }),
  setAutoCoding: (v) => set({ autoCoding: v }),

  setActiveJobId: (id) => set({ activeJobId: id }),

  setResult: (dxfUrl, previewUrl, imageHeight) =>
    set({
      resultDxfUrl: dxfUrl,
      resultPreviewUrl: previewUrl,
      resultImageHeight: imageHeight ?? null,
    }),

  // Coding state
  setCodingMode: (mode) => set({ codingMode: mode }),
  setCodingTool: (tool) => set({ codingTool: tool }),
  setCodingConfig: (config) => set({ codingConfig: config }),

  addInnerAxis: (x, label) => {
    const { codingConfig } = get();
    if (codingConfig.innerAxes.length >= 30) return;
    const finalLabel = label || nextInnerAxisLabel(codingConfig.innerAxes);
    set({
      codingConfig: {
        ...codingConfig,
        innerAxes: [...codingConfig.innerAxes, { x, label: finalLabel }],
      },
    });
  },

  removeInnerAxis: (index) => {
    const { codingConfig } = get();
    set({
      codingConfig: {
        ...codingConfig,
        innerAxes: codingConfig.innerAxes.filter((_, i) => i !== index),
      },
    });
  },

  updateInnerAxisLabel: (index, label) => {
    const { codingConfig } = get();
    const updated = [...codingConfig.innerAxes];
    if (updated[index]) updated[index] = { ...updated[index], label };
    set({ codingConfig: { ...codingConfig, innerAxes: updated } });
  },

  addOuterAxis: (y, label) => {
    const { codingConfig } = get();
    if (codingConfig.outerAxes.length >= 10) return;
    const finalLabel = label || nextOuterAxisLabel(codingConfig.outerAxes);
    set({
      codingConfig: {
        ...codingConfig,
        outerAxes: [...codingConfig.outerAxes, { y, label: finalLabel }],
      },
    });
  },

  removeOuterAxis: (index) => {
    const { codingConfig } = get();
    set({
      codingConfig: {
        ...codingConfig,
        outerAxes: codingConfig.outerAxes.filter((_, i) => i !== index),
      },
    });
  },

  updateOuterAxisLabel: (index, label) => {
    const { codingConfig } = get();
    const updated = [...codingConfig.outerAxes];
    if (updated[index]) updated[index] = { ...updated[index], label };
    set({ codingConfig: { ...codingConfig, outerAxes: updated } });
  },

  addText: (x, y, value) => {
    const { codingConfig } = get();
    set({
      codingConfig: {
        ...codingConfig,
        texts: [...codingConfig.texts, { x, y, value, fontSize: 12 }],
      },
    });
  },

  removeText: (index) => {
    const { codingConfig } = get();
    set({
      codingConfig: {
        ...codingConfig,
        texts: codingConfig.texts.filter((_, i) => i !== index),
      },
    });
  },

  updateText: (index, updates) => {
    const { codingConfig } = get();
    const updated = [...codingConfig.texts];
    if (updated[index]) updated[index] = { ...updated[index], ...updates };
    set({ codingConfig: { ...codingConfig, texts: updated } });
  },

  setCodedResult: (dxfUrl, previewUrl) =>
    set({ codedDxfUrl: dxfUrl, codedPreviewUrl: previewUrl }),

  reset: () => {
    const prev = get().localPreviewUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({ ...initialState, codingConfig: { ...emptyCodingConfig } });
  },
}));
