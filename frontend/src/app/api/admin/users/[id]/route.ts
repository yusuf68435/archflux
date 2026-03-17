import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminUpdateUserSchema } from "@/lib/validators";
import { addCredits } from "@/lib/credits";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user as Record<string, unknown>).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      credits: true,
      createdAt: true,
      _count: { select: { jobs: true, transactions: true, refundRequests: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [jobs, transactions] = await Promise.all([
    prisma.job.findMany({
      where: { userId: id },
      select: {
        id: true,
        type: true,
        status: true,
        creditsCost: true,
        createdAt: true,
        completedAt: true,
        errorMessage: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.creditTransaction.findMany({
      where: { userId: id },
      select: {
        id: true,
        amount: true,
        balance: true,
        type: true,
        description: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({ user, jobs, transactions });
}

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
  const parsed = adminUpdateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { role, credits } = parsed.data;

  if (role) {
    await prisma.user.update({ where: { id }, data: { role } });
  }

  if (credits !== undefined) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { credits: true },
    });
    if (user) {
      const diff = credits - user.credits;
      if (diff > 0) {
        await addCredits(id, diff, "ADMIN_GRANT", `Admin granted ${diff} credits`);
      } else if (diff < 0) {
        await prisma.$transaction([
          prisma.user.update({ where: { id }, data: { credits } }),
          prisma.creditTransaction.create({
            data: {
              userId: id,
              amount: diff,
              balance: credits,
              type: "ADMIN_REVOKE",
              description: `Admin revoked ${Math.abs(diff)} credits`,
            },
          }),
        ]);
      }
    }
  }

  const updated = await prisma.user.findUnique({ where: { id } });
  return NextResponse.json(updated);
}
