"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface DailyTrend {
  date: string;
  jobs: number;
  completed: number;
  failed: number;
  revenue: number;
}

interface TypeDistribution {
  type: string;
  count: number;
}

interface Stats {
  totalUsers: number;
  activeUsers: number;
  totalJobs: number;
  jobsToday: number;
  completedJobs: number;
  failedJobs: number;
  pendingRefunds: number;
  totalCreditsInCirculation: number;
  successRate: number;
  dailyTrend: DailyTrend[];
  typeDistribution: TypeDistribution[];
}

interface ServiceStatus {
  name: string;
  status: "healthy" | "unhealthy" | "unknown";
  latencyMs?: number;
  detail?: string;
}

interface HealthData {
  services: ServiceStatus[];
  checkedAt: string;
}

const PIE_COLORS = ["#3b82f6", "#a855f7", "#22c55e", "#06b6d4"];

const TYPE_LABELS: Record<string, string> = {
  FULL_CONVERSION: "Full",
  PARTIAL_SPLIT: "Split",
  DETAIL_EXTRACTION: "Detail",
  AUTO_CODING: "Coding",
};

export default function AdminDashboard() {
  const t = useTranslations("admin");
  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats);
    fetch("/api/admin/health")
      .then((r) => r.json())
      .then(setHealth);
  }, []);

  if (!stats) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">{t("dashboard")}</h1>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    { title: t("totalUsers"), value: stats.totalUsers, href: "/admin/users" },
    { title: t("activeUsers"), value: stats.activeUsers },
    { title: t("totalJobs"), value: stats.totalJobs },
    { title: t("todaysJobs"), value: stats.jobsToday },
    { title: t("completedJobs"), value: stats.completedJobs },
    { title: t("failedJobs"), value: stats.failedJobs, color: stats.failedJobs > 0 ? "text-red-500" : undefined },
    { title: t("pendingRefunds"), value: stats.pendingRefunds, href: "/admin/refunds", color: stats.pendingRefunds > 0 ? "text-yellow-500" : undefined },
    { title: t("successRate"), value: `%${stats.successRate}` },
  ];

  const pieData = stats.typeDistribution.map((item) => ({
    name: TYPE_LABELS[item.type] || item.type,
    value: item.count,
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t("dashboard")}</h1>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {cards.map((card) => {
          const content = (
            <Card className={card.href ? "hover:bg-accent cursor-pointer transition-colors" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${card.color || ""}`}>{card.value}</div>
              </CardContent>
            </Card>
          );

          return card.href ? (
            <Link key={card.title} href={card.href}>
              {content}
            </Link>
          ) : (
            <div key={card.title}>{content}</div>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Daily Jobs Trend — AreaChart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("totalJobs")} (14 {t("date")})</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={stats.dailyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradOk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  labelFormatter={(v) => `📅 ${v}`}
                />
                <Area type="monotone" dataKey="jobs" name="Toplam" stroke="#6366f1" fill="url(#gradTotal)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="completed" name="Başarılı" stroke="#22c55e" fill="url(#gradOk)" strokeWidth={2} dot={false} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Job Type Distribution — PieChart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">İş Türü Dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-16">{t("noJobs")}</p>
            )}
          </CardContent>
        </Card>

        {/* Credits Usage — AreaChart */}
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Kredi Kullanımı (14 gün)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={stats.dailyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} labelFormatter={(v) => `📅 ${v}`} />
                <Area type="monotone" dataKey="revenue" name="Kredi" stroke="#06b6d4" fill="url(#gradRevenue)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{t("systemHealth")}</CardTitle>
            {health && (
              <span className="text-xs text-muted-foreground">
                {t("lastChecked")}: {new Date(health.checkedAt).toLocaleTimeString("tr-TR")}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!health ? (
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {health.services.map((svc) => {
                const statusColor = {
                  healthy: "bg-green-500",
                  unhealthy: "bg-red-500",
                  unknown: "bg-yellow-500",
                }[svc.status];
                const statusText = {
                  healthy: t("healthy"),
                  unhealthy: t("unhealthy"),
                  unknown: t("unknown"),
                }[svc.status];
                const nameLabel = ({
                  database: t("database"),
                  backend: t("backend"),
                  celery: t("celery"),
                  minio: t("minio"),
                } as Record<string, string>)[svc.name] || svc.name;

                return (
                  <div key={svc.name} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className={`h-3 w-3 rounded-full flex-shrink-0 ${statusColor}`} />
                    <div>
                      <p className="text-sm font-medium">{nameLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {statusText}
                        {svc.latencyMs !== undefined && ` (${svc.latencyMs}ms)`}
                      </p>
                      {svc.detail && (
                        <p className="text-xs text-muted-foreground">{svc.detail}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
