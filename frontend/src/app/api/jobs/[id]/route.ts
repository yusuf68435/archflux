import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskStatus } from "@/lib/ai-service";
import { getPresignedDownloadUrl } from "@/lib/s3";
import { sendJobCompletedEmail, sendJobFailedEmail } from "@/lib/email";

/**
 * Parse an S3 URL (http://endpoint/bucket/key) into { bucket, key }.
 * Returns null if the URL doesn't match the expected format.
 */
function parseS3Url(url: string): { bucket: string; key: string } | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { bucket: parts[0], key: parts.slice(1).join("/") };
  } catch {
    return null;
  }
}

/**
 * Convert a raw S3 URL to a presigned download URL accessible from the browser.
 */
async function toPresignedUrl(s3Url: string | null | undefined): Promise<string> {
  if (!s3Url) return "";
  const parsed = parseS3Url(s3Url);
  if (!parsed) return s3Url;
  return getPresignedDownloadUrl(parsed.bucket, parsed.key);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const job = await prisma.job.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // If job is in progress, check backend for latest status
  if (job.celeryTaskId && ["QUEUED", "PROCESSING"].includes(job.status)) {
    try {
      const taskStatus = await getTaskStatus(job.celeryTaskId);

      const updates: Record<string, unknown> = {};
      if (taskStatus.progress !== undefined) {
        updates.progress = taskStatus.progress;
      }

      if (taskStatus.status === "SUCCESS" && taskStatus.result) {
        updates.status = "COMPLETED";
        updates.progress = 100;
        updates.completedAt = new Date();
        updates.outputDxfUrl = taskStatus.result.dxf_url;
        updates.outputPreviewUrl = taskStatus.result.preview_url;
        updates.outputMeta = taskStatus.result.meta;
      } else if (taskStatus.status === "FAILURE") {
        updates.status = "FAILED";
        updates.errorMessage = taskStatus.error || "Processing failed";
      } else if (taskStatus.status === "PROGRESS") {
        updates.status = "PROCESSING";
        if (!job.startedAt) updates.startedAt = new Date();
      }

      if (Object.keys(updates).length > 0) {
        const updatedJob = await prisma.job.update({
          where: { id },
          data: updates,
          include: { user: true },
        });

        // Send email notification on terminal status transitions
        if (updates.status === "COMPLETED" && updatedJob.user?.email) {
          sendJobCompletedEmail({
            to: updatedJob.user.email,
            name: updatedJob.user.name,
            jobId: id,
            locale: (updatedJob.user as Record<string, unknown>).locale as string || "tr",
          }).catch(() => {});
        } else if (updates.status === "FAILED" && updatedJob.user?.email) {
          sendJobFailedEmail({
            to: updatedJob.user.email,
            name: updatedJob.user.name,
            locale: (updatedJob.user as Record<string, unknown>).locale as string || "tr",
          }).catch(() => {});
        }

        // Convert S3 URLs to presigned for browser access
        const response: Record<string, unknown> = {
          ...updatedJob,
          stage: taskStatus.stage || "",
        };
        if (updatedJob.status === "COMPLETED") {
          response.outputDxfUrl = await toPresignedUrl(updatedJob.outputDxfUrl);
          response.outputPreviewUrl = await toPresignedUrl(updatedJob.outputPreviewUrl);
        }
        return NextResponse.json(response);
      }
    } catch {
      // If backend is unreachable, return current state
    }
  }

  // For completed jobs, convert stored S3 URLs to presigned URLs
  if (job.status === "COMPLETED") {
    return NextResponse.json({
      ...job,
      outputDxfUrl: await toPresignedUrl(job.outputDxfUrl),
      outputPreviewUrl: await toPresignedUrl(job.outputPreviewUrl),
    });
  }

  return NextResponse.json(job);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const job = await prisma.job.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (!["PENDING", "QUEUED"].includes(job.status)) {
    return NextResponse.json(
      { error: "Can only cancel pending/queued jobs" },
      { status: 400 }
    );
  }

  await prisma.job.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({ success: true });
}
