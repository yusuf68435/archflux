import { describe, it, expect } from "vitest";
import { createJobSchema, applyCodingSchema, refundRequestSchema } from "../validators";

describe("createJobSchema", () => {
  it("validates a valid full conversion request", () => {
    const result = createJobSchema.safeParse({
      type: "FULL_CONVERSION",
      inputImageUrl: "http://localhost:9000/uploads/test.jpg",
    });
    expect(result.success).toBe(true);
  });

  it("validates with crop region", () => {
    const result = createJobSchema.safeParse({
      type: "FULL_CONVERSION",
      inputImageUrl: "http://localhost:9000/uploads/test.jpg",
      cropRegion: { x: 0.1, y: 0.2, width: 0.5, height: 0.6 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid crop region values", () => {
    const result = createJobSchema.safeParse({
      type: "FULL_CONVERSION",
      inputImageUrl: "http://localhost:9000/uploads/test.jpg",
      cropRegion: { x: 2, y: 0.2, width: 0.5, height: 0.6 },
    });
    expect(result.success).toBe(false);
  });

  it("validates partial split config", () => {
    const result = createJobSchema.safeParse({
      type: "PARTIAL_SPLIT",
      inputImageUrl: "http://localhost:9000/uploads/test.jpg",
      splitConfig: { direction: "horizontal", parts: 3 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid job type", () => {
    const result = createJobSchema.safeParse({
      type: "INVALID_TYPE",
      inputImageUrl: "http://localhost:9000/uploads/test.jpg",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing image url", () => {
    const result = createJobSchema.safeParse({
      type: "FULL_CONVERSION",
    });
    expect(result.success).toBe(false);
  });

  it("validates coding config", () => {
    const result = createJobSchema.safeParse({
      type: "AUTO_CODING",
      inputImageUrl: "http://localhost:9000/uploads/test.jpg",
      codingConfig: {
        innerAxes: [{ x: 100, label: "A" }],
        outerAxes: [{ y: 200, label: "1" }],
        texts: [{ x: 50, y: 50, value: "test" }],
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects too many inner axes", () => {
    const result = createJobSchema.safeParse({
      type: "AUTO_CODING",
      inputImageUrl: "http://localhost:9000/uploads/test.jpg",
      codingConfig: {
        innerAxes: Array.from({ length: 31 }, (_, i) => ({ x: i * 10, label: `A${i}` })),
        outerAxes: [],
        texts: [],
      },
    });
    expect(result.success).toBe(false);
  });
});

describe("applyCodingSchema", () => {
  it("validates auto coding request", () => {
    const result = applyCodingSchema.safeParse({
      jobId: "job123",
      dxfUrl: "http://localhost:9000/results/test.dxf",
      imageUrl: "http://localhost:9000/uploads/test.jpg",
      imageHeight: 600,
      mode: "auto",
    });
    expect(result.success).toBe(true);
  });

  it("validates manual coding request", () => {
    const result = applyCodingSchema.safeParse({
      jobId: "job123",
      dxfUrl: "http://localhost:9000/results/test.dxf",
      imageUrl: "http://localhost:9000/uploads/test.jpg",
      imageHeight: 600,
      mode: "manual",
      codingConfig: {
        innerAxes: [{ x: 100, label: "A" }],
        outerAxes: [],
        texts: [],
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid mode", () => {
    const result = applyCodingSchema.safeParse({
      jobId: "job123",
      dxfUrl: "http://localhost:9000/results/test.dxf",
      imageUrl: "http://localhost:9000/uploads/test.jpg",
      imageHeight: 600,
      mode: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

describe("refundRequestSchema", () => {
  it("validates a valid refund reason", () => {
    const result = refundRequestSchema.safeParse({
      reason: "The conversion quality was poor and unusable for my project",
    });
    expect(result.success).toBe(true);
  });

  it("rejects too short reason", () => {
    const result = refundRequestSchema.safeParse({
      reason: "bad",
    });
    expect(result.success).toBe(false);
  });
});
