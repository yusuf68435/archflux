import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refundRequestSchema } from "@/lib/validators";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = refundRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const job = await prisma.job.findFirst({
    where: { id, userId: session.user.id, status: "COMPLETED" },
    include: { refundRequest: true },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.refundRequest) {
    return NextResponse.json(
      { error: "Refund already requested" },
      { status: 400 }
    );
  }

  const refund = await prisma.refundRequest.create({
    data: {
      jobId: id,
      userId: session.user.id,
      reason: parsed.data.reason,
    },
  });

  return NextResponse.json(refund);
}
