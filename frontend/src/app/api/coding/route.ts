import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyCodingSchema } from "@/lib/validators";
import { requestAutoCoding, requestManualCoding } from "@/lib/ai-service";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = applyCodingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { jobId, dxfUrl, imageUrl, imageHeight, mode, codingConfig } = parsed.data;

  // Verify job belongs to user and is completed
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId: session.user.id, status: "COMPLETED" },
  });

  if (!job) {
    return NextResponse.json(
      { error: "Job not found or not completed" },
      { status: 404 }
    );
  }

  try {
    let result;
    if (mode === "auto") {
      result = await requestAutoCoding(jobId, dxfUrl, imageUrl, imageHeight);
    } else {
      if (!codingConfig) {
        return NextResponse.json(
          { error: "codingConfig required for manual coding" },
          { status: 400 }
        );
      }
      result = await requestManualCoding(jobId, dxfUrl, codingConfig, imageHeight);
    }

    // Store coding config on the job
    await prisma.job.update({
      where: { id: jobId },
      data: {
        codingConfig: codingConfig || undefined,
        celeryTaskId: result.task_id,
        status: "PROCESSING",
        progress: 0,
      },
    });

    return NextResponse.json({ taskId: result.task_id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Coding failed" },
      { status: 500 }
    );
  }
}
