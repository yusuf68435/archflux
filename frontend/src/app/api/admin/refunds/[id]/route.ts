import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminRefundSchema } from "@/lib/validators";
import { addCredits } from "@/lib/credits";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user as Record<string, unknown>).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = adminRefundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const refund = await prisma.refundRequest.findUnique({
    where: { id },
    include: { job: true },
  });

  if (!refund) {
    return NextResponse.json({ error: "Refund not found" }, { status: 404 });
  }

  if (refund.status !== "PENDING") {
    return NextResponse.json(
      { error: "Refund already processed" },
      { status: 400 }
    );
  }

  // Update refund status
  await prisma.refundRequest.update({
    where: { id },
    data: {
      status: parsed.data.status,
      adminNote: parsed.data.adminNote,
      resolvedAt: new Date(),
    },
  });

  // If approved, restore credits
  if (parsed.data.status === "APPROVED") {
    await addCredits(
      refund.userId,
      refund.job.creditsCost,
      "REFUND",
      `Refund for job ${refund.jobId}`,
      undefined,
      refund.jobId
    );
  }

  return NextResponse.json({ success: true });
}
