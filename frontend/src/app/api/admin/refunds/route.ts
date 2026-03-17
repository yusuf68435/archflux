import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as Record<string, unknown>).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where = status ? { status: status as "PENDING" | "APPROVED" | "REJECTED" } : {};

  const refunds = await prisma.refundRequest.findMany({
    where,
    include: {
      user: { select: { email: true, name: true } },
      job: { select: { type: true, creditsCost: true, outputPreviewUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(refunds);
}
