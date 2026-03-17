import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as Record<string, unknown>).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers,
    totalJobs,
    jobsToday,
    completedJobs,
    failedJobs,
    pendingRefunds,
    totalCreditsInCirculation,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: { jobs: { some: { createdAt: { gte: weekAgo } } } },
    }),
    prisma.job.count(),
    prisma.job.count({ where: { createdAt: { gte: today } } }),
    prisma.job.count({ where: { status: "COMPLETED" } }),
    prisma.job.count({ where: { status: "FAILED" } }),
    prisma.refundRequest.count({ where: { status: "PENDING" } }),
    prisma.user.aggregate({ _sum: { credits: true } }),
  ]);

  // Daily job counts for the last 14 days (for chart)
  const fourteenDaysAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  const recentJobs = await prisma.job.findMany({
    where: { createdAt: { gte: fourteenDaysAgo } },
    select: { createdAt: true, status: true, type: true, creditsCost: true },
  });

  // Aggregate by date
  const dailyStats: Record<string, { jobs: number; completed: number; failed: number; revenue: number }> = {};
  for (let d = 0; d < 14; d++) {
    const date = new Date(today.getTime() - d * 24 * 60 * 60 * 1000);
    const key = date.toISOString().split("T")[0];
    dailyStats[key] = { jobs: 0, completed: 0, failed: 0, revenue: 0 };
  }

  for (const job of recentJobs) {
    const key = job.createdAt.toISOString().split("T")[0];
    if (dailyStats[key]) {
      dailyStats[key].jobs++;
      if (job.status === "COMPLETED") dailyStats[key].completed++;
      if (job.status === "FAILED") dailyStats[key].failed++;
      dailyStats[key].revenue += job.creditsCost;
    }
  }

  const dailyTrend = Object.entries(dailyStats)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));

  // Job type distribution
  const jobTypeDistribution = await prisma.job.groupBy({
    by: ["type"],
    _count: { id: true },
  });

  const typeDistribution = jobTypeDistribution.map((item) => ({
    type: item.type,
    count: item._count.id,
  }));

  // Success rate
  const successRate = totalJobs > 0
    ? Math.round((completedJobs / totalJobs) * 100)
    : 0;

  return NextResponse.json({
    totalUsers,
    activeUsers,
    totalJobs,
    jobsToday,
    completedJobs,
    failedJobs,
    pendingRefunds,
    totalCreditsInCirculation: totalCreditsInCirculation._sum.credits || 0,
    successRate,
    dailyTrend,
    typeDistribution,
  });
}
