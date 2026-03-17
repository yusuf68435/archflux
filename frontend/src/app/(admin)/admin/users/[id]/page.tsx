"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface UserDetail {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  credits: number;
  createdAt: string;
  _count: { jobs: number; transactions: number; refundRequests: number };
}

interface Job {
  id: string;
  type: string;
  status: string;
  creditsCost: number;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

interface Transaction {
  id: string;
  amount: number;
  balance: number;
  type: string;
  description: string | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  COMPLETED: "bg-green-500/10 text-green-600",
  FAILED: "bg-red-500/10 text-red-600",
  PROCESSING: "bg-blue-500/10 text-blue-600",
  PENDING: "bg-yellow-500/10 text-yellow-600",
  QUEUED: "bg-yellow-500/10 text-yellow-600",
  CANCELLED: "bg-gray-500/10 text-gray-600",
};

const txTypeColors: Record<string, string> = {
  PURCHASE: "bg-green-500/10 text-green-600",
  USAGE: "bg-red-500/10 text-red-600",
  REFUND: "bg-blue-500/10 text-blue-600",
  ADMIN_GRANT: "bg-purple-500/10 text-purple-600",
  ADMIN_REVOKE: "bg-orange-500/10 text-orange-600",
  BONUS: "bg-cyan-500/10 text-cyan-600",
};

export default function UserDetailPage() {
  const t = useTranslations("admin");
  const params = useParams();
  const userId = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/users/${userId}`)
      .then((r) => r.json())
      .then((data) => {
        setUser(data.user);
        setJobs(data.jobs || []);
        setTransactions(data.transactions || []);
      })
      .catch(() => toast.error(t("operationFailed")))
      .finally(() => setLoading(false));
  }, [userId, t]);

  const handleGrantCredits = async (amount: number) => {
    if (!user) return;
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credits: user.credits + amount }),
    });
    if (res.ok) {
      toast.success(t("creditsAdded", { amount }));
      const data = await fetch(`/api/admin/users/${userId}`).then((r) => r.json());
      setUser(data.user);
      setTransactions(data.transactions || []);
    } else {
      toast.error(t("creditsFailed"));
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <p className="text-muted-foreground">{t("userNotFound")}</p>
        <Link href="/admin/users">
          <Button variant="outline">{t("backToUsers")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/users">
          <Button variant="ghost" size="sm">&larr; {t("backToUsers")}</Button>
        </Link>
        <h1 className="text-2xl font-bold">{t("userDetail")}</h1>
      </div>

      {/* User Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{user.name || "-"}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                  {user.role}
                </Badge>
                <span className="text-sm">
                  {t("credit")}: <strong>{user.credits}</strong>
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("registered")}: {new Date(user.createdAt).toLocaleDateString("tr-TR")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleGrantCredits(10)}>
                +10 {t("credit")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleGrantCredits(50)}>
                +50 {t("credit")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleGrantCredits(100)}>
                +100 {t("credit")}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t text-center">
            <div>
              <p className="text-2xl font-bold">{user._count.jobs}</p>
              <p className="text-xs text-muted-foreground">{t("jobs")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{user._count.transactions}</p>
              <p className="text-xs text-muted-foreground">{t("creditTransactions")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{user._count.refundRequests}</p>
              <p className="text-xs text-muted-foreground">{t("refunds")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Job History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t("jobHistory")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("noJobs")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">{t("type")}</th>
                    <th className="text-left p-3">{t("status")}</th>
                    <th className="text-right p-3">{t("cost")}</th>
                    <th className="text-left p-3">{t("date")}</th>
                    <th className="text-left p-3">{t("error")}</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b hover:bg-muted/50">
                      <td className="p-3">
                        <span className="text-xs font-mono">{job.type.replace(/_/g, " ")}</span>
                      </td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[job.status] || ""}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">{job.creditsCost}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(job.createdAt).toLocaleString("tr-TR")}
                      </td>
                      <td className="p-3 text-xs text-red-500 max-w-[200px] truncate">
                        {job.errorMessage || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t("creditTransactions")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("noTransactions")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">{t("type")}</th>
                    <th className="text-right p-3">{t("amount")}</th>
                    <th className="text-right p-3">{t("balance")}</th>
                    <th className="text-left p-3">{t("description")}</th>
                    <th className="text-left p-3">{t("date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b hover:bg-muted/50">
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${txTypeColors[tx.type] || ""}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className={`p-3 text-right font-mono ${tx.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                      </td>
                      <td className="p-3 text-right font-mono">{tx.balance}</td>
                      <td className="p-3 text-xs text-muted-foreground max-w-[250px] truncate">
                        {tx.description || "-"}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleString("tr-TR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
