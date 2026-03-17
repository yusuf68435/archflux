import { z } from "zod";

export const createJobSchema = z.object({
  type: z.enum([
    "FULL_CONVERSION",
    "PARTIAL_SPLIT",
    "DETAIL_EXTRACTION",
    "AUTO_CODING",
  ]),
  inputImageUrl: z.string().url(),
  cropRegion: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().min(0).max(1),
      height: z.number().min(0).max(1),
    })
    .optional(),
  splitConfig: z
    .object({
      direction: z.enum(["horizontal", "vertical"]),
      parts: z.number().int().min(2).max(4),
    })
    .optional(),
  detailRegion: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().min(0).max(1),
      height: z.number().min(0).max(1),
    })
    .optional(),
  codingConfig: z
    .object({
      innerAxes: z.array(z.object({ x: z.number(), label: z.string() })).max(30),
      outerAxes: z.array(z.object({ y: z.number(), label: z.string() })).max(10),
      texts: z.array(
        z.object({
          x: z.number(),
          y: z.number(),
          value: z.string(),
          fontSize: z.number().optional(),
        })
      ),
    })
    .optional(),
});

export const applyCodingSchema = z.object({
  jobId: z.string().min(1),
  dxfUrl: z.string().url(),
  imageUrl: z.string().url(),
  imageHeight: z.number().int().positive(),
  mode: z.enum(["auto", "manual"]),
  codingConfig: z
    .object({
      innerAxes: z.array(z.object({ x: z.number(), label: z.string() })).max(30),
      outerAxes: z.array(z.object({ y: z.number(), label: z.string() })).max(10),
      texts: z.array(
        z.object({
          x: z.number(),
          y: z.number(),
          value: z.string(),
          fontSize: z.number().optional(),
        })
      ),
    })
    .optional(),
});

export const refundRequestSchema = z.object({
  reason: z.string().min(10).max(1000),
});

export const updateUserSchema = z.object({
  locale: z.string().optional(),
  theme: z.enum(["LIGHT", "DARK", "SYSTEM"]).optional(),
  name: z.string().min(1).max(100).optional(),
});

export const adminUpdateUserSchema = z.object({
  role: z.enum(["USER", "ADMIN"]).optional(),
  credits: z.number().int().min(0).optional(),
});

export const adminRefundSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  adminNote: z.string().optional(),
});
