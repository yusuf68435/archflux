import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deductCredits, JOB_COSTS } from "@/lib/credits";
import { createJobSchema } from "@/lib/validators";
import {
  requestFullConversion,
  requestPartialSplit,
  requestDetailExtraction,
} from "@/lib/ai-service";
import { rateLimitByIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimitByIp(ip, "jobs", 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { type, inputImageUrl, cropRegion, splitConfig, detailRegion, codingConfig } =
    parsed.data;

  // Create job record
  const job = await prisma.job.create({
    data: {
      userId: session.user.id,
      type,
      status: "PENDING",
      creditsCost: JOB_COSTS[type],
      inputImageUrl,
      cropRegion: cropRegion || undefined,
      splitConfig: splitConfig || undefined,
      detailRegion: detailRegion || undefined,
      codingConfig: codingConfig || undefined,
    },
  });

  try {
    // Deduct credits atomically
    await deductCredits(session.user.id, type, job.id);
  } catch (error) {
    // Rollback job creation
    await prisma.job.delete({ where: { id: job.id } });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Credit deduction failed" },
      { status: 402 }
    );
  }

  try {
    // Queue processing on AI backend
    let result;
    switch (type) {
      case "FULL_CONVERSION":
        result = await requestFullConversion(job.id, inputImageUrl, cropRegion);
        break;
      case "PARTIAL_SPLIT":
        result = await requestPartialSplit(job.id, inputImageUrl, splitConfig!);
        break;
      case "DETAIL_EXTRACTION":
        result = await requestDetailExtraction(
          job.id,
          inputImageUrl,
          detailRegion!
        );
        break;
      case "AUTO_CODING":
        // Auto coding is handled separately via /api/coding after job completes
        result = await requestFullConversion(job.id, inputImageUrl);
        break;
      default:
        result = await requestFullConversion(job.id, inputImageUrl);
    }

    // Update job with celery task ID
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "QUEUED",
        celeryTaskId: result.task_id,
      },
    });

    return NextResponse.json({ id: job.id, taskId: result.task_id });
  } catch (error) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorMessage:
          error instanceof Error ? error.message : "Failed to queue job",
      },
    });
    return NextResponse.json(
      { error: "Failed to start processing" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.job.count({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json({ jobs, total, page, limit });
}
