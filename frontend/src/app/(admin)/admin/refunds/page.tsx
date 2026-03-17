"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface RefundRequest {
  id: string;
  jobId: string;
  reason: string;
  status: string;
  createdAt: string;
  user: { email: string; name: string | null };
  job: { type: string; creditsCost: number; outputPreviewUrl: string | null };
}

type StatusFilter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

export default function AdminRefundsPage() {
  const t = useTranslations("admin");
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchRefunds = async (status: StatusFilter = statusFilter) => {
    const query = status === "ALL" ? "" : `?status=${status}`;
    const res = await fetch(`/api/admin/refunds${query}`);
    const data = await res.json();
    setRefunds(data);
    setSelected(new Set());
  };

  useEffect(() => {
    fetchRefunds();
  }, [statusFilter]);

  const handleAction = async (id: string, status: "APPROVED" | "REJECTED") => {
    const res = await fetch(`/api/admin/refunds/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, adminNote: adminNotes[id] || "" }),
    });

    if (res.ok) {
      toast.success(
        status === "APPROVED" ? t("refundApproved") : t("refundRejected")
      );
      fetchRefunds();
    } else {
      toast.error(t("operationFailed"));
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pendingRefunds = refunds.filter((r) => r.status === "PENDING");
  const selectablePending = pendingRefunds.filter((r) => selected.has(r.id) || r.status === "PENDING");

  const toggleAll = () => {
    const pendingIds = pendingRefunds.map((r) => r.id);
    if (pendingIds.every((id) => selected.has(id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingIds));
    }
  };

  const handleBulkAction = async (status: "APPROVED" | "REJECTED") => {
    if (selected.size === 0) return;
    setBulkLoading(true);

    const promises = Array.from(selected).map((id) =>
      fetch(`/api/admin/refunds/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote: "" }),
      })
    );

    await Promise.all(promises);
    toast.success(
      status === "APPROVED"
        ? t("bulkApproveSuccess", { count: selected.size })
        : t("bulkRejectSuccess", { count: selected.size })
    );
    setBulkLoading(false);
    fetchRefunds();
  };

  const statusFilterButtons: { value: StatusFilter; label: string }[] = [
    { value: "ALL", label: t("all") },
    { value: "PENDING", label: t("pending") },
    { value: "APPROVED", label: t("approved") },
    { value: "REJECTED", label: t("rejected") },
  ];

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "APPROVED": return "default" as const;
      case "REJECTED": return "destructive" as const;
      default: return "outline" as const;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t("refundRequests")}</h1>

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{t("filterByStatus")}:</span>
        {statusFilterButtons.map((btn) => (
          <Button
            key={btn.value}
            size="sm"
            variant={statusFilter === btn.value ? "default" : "outline"}
            onClick={() => setStatusFilter(btn.value)}
          >
            {btn.label}
          </Button>
        ))}
      </div>

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <Card>
          <CardContent className="py-3 flex items-center gap-3">
            <span className="text-sm font-medium">
              {t("selectedUsers", { count: selected.size })}
            </span>
            <Button
              size="sm"
              onClick={() => handleBulkAction("APPROVED")}
              disabled={bulkLoading}
            >
              {t("bulkApprove")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleBulkAction("REJECTED")}
              disabled={bulkLoading}
            >
              {t("bulkReject")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Select All for pending */}
      {pendingRefunds.length > 0 && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={pendingRefunds.length > 0 && pendingRefunds.every((r) => selected.has(r.id))}
            onChange={toggleAll}
            className="rounded"
          />
          <span className="text-sm text-muted-foreground">
            {t("pending")}: {pendingRefunds.length}
          </span>
        </div>
      )}

      {refunds.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t("noRefunds")}
          </CardContent>
        </Card>
      )}

      {refunds.map((refund) => (
        <Card key={refund.id} className={selected.has(refund.id) ? "ring-2 ring-primary" : ""}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-3">
                {refund.status === "PENDING" && (
                  <input
                    type="checkbox"
                    checked={selected.has(refund.id)}
                    onChange={() => toggleSelect(refund.id)}
                    className="rounded mt-1"
                  />
                )}
                <div>
                  <CardTitle className="text-base">
                    {refund.user.name || refund.user.email}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {refund.user.email} &bull; {refund.job.type} &bull; {refund.job.creditsCost} {t("credit")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusBadgeVariant(refund.status)}>
                  {refund.status}
                </Badge>
                <Badge variant="outline">
                  {new Date(refund.createdAt).toLocaleDateString("tr-TR")}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm font-medium mb-1">{t("refundReason")}</p>
              <p className="text-sm">{refund.reason}</p>
            </div>

            {refund.status === "PENDING" && (
              <>
                <Textarea
                  placeholder={t("adminNote")}
                  value={adminNotes[refund.id] || ""}
                  onChange={(e) =>
                    setAdminNotes((prev) => ({
                      ...prev,
                      [refund.id]: e.target.value,
                    }))
                  }
                />

                <div className="flex gap-3 justify-end">
                  <Button
                    variant="destructive"
                    onClick={() => handleAction(refund.id, "REJECTED")}
                  >
                    {t("reject")}
                  </Button>
                  <Button onClick={() => handleAction(refund.id, "APPROVED")}>
                    {t("approveRefund", { credits: refund.job.creditsCost })}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
