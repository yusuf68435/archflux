"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  credits: number;
  createdAt: string;
  _count: { jobs: number };
}

export default function AdminUsersPage() {
  const t = useTranslations("admin");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAmount, setBulkAmount] = useState("10");
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchUsers = async (query: string = "") => {
    setLoading(true);
    const res = await fetch(
      `/api/admin/users?search=${encodeURIComponent(query)}`
    );
    const data = await res.json();
    setUsers(data.users || []);
    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSearch = () => fetchUsers(search);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === users.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(users.map((u) => u.id)));
    }
  };

  const handleGrantCredits = async (userId: string, amount: number) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credits: user.credits + amount }),
    });

    if (res.ok) {
      toast.success(t("creditsAdded", { amount }));
      fetchUsers(search);
    } else {
      toast.error(t("creditsFailed"));
    }
  };

  const handleBulkGrant = async () => {
    const amount = parseInt(bulkAmount, 10);
    if (isNaN(amount) || amount <= 0 || selected.size === 0) return;

    setBulkLoading(true);
    const promises = Array.from(selected).map((userId) => {
      const user = users.find((u) => u.id === userId);
      if (!user) return Promise.resolve();
      return fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: user.credits + amount }),
      });
    });

    await Promise.all(promises);
    toast.success(t("bulkGrantSuccess", { count: selected.size, amount }));
    setBulkLoading(false);
    fetchUsers(search);
  };

  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "ADMIN" ? "USER" : "ADMIN";
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });

    if (res.ok) {
      toast.success(t("roleChanged", { role: newRole }));
      fetchUsers(search);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t("userManagement")}</h1>

      <div className="flex gap-2">
        <Input
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <Button onClick={handleSearch}>{t("search")}</Button>
      </div>

      {/* Bulk Credit Grant Bar */}
      {selected.size > 0 && (
        <Card>
          <CardContent className="py-3 flex items-center gap-3">
            <span className="text-sm font-medium">
              {t("selectedUsers", { count: selected.size })}
            </span>
            <Input
              type="number"
              min="1"
              value={bulkAmount}
              onChange={(e) => setBulkAmount(e.target.value)}
              className="w-24"
              placeholder={t("grantAmount")}
            />
            <Button
              size="sm"
              onClick={handleBulkGrant}
              disabled={bulkLoading}
            >
              {t("grant")} +{bulkAmount} {t("credit")}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3 w-8">
                    <input
                      type="checkbox"
                      checked={users.length > 0 && selected.size === users.length}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left p-3">{t("user")}</th>
                  <th className="text-left p-3">{t("role")}</th>
                  <th className="text-right p-3">{t("credit")}</th>
                  <th className="text-right p-3">{t("jobs")}</th>
                  <th className="text-left p-3">{t("registered")}</th>
                  <th className="text-right p-3">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.has(user.id)}
                        onChange={() => toggleSelect(user.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="p-3">
                      <Link href={`/admin/users/${user.id}`} className="hover:underline">
                        <p className="font-medium">{user.name || "-"}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.email}
                        </p>
                      </Link>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={user.role === "ADMIN" ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => handleToggleRole(user.id, user.role)}
                      >
                        {user.role}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">{user.credits}</td>
                    <td className="p-3 text-right">{user._count.jobs}</td>
                    <td className="p-3 text-xs">
                      {new Date(user.createdAt).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGrantCredits(user.id, 10)}
                      >
                        +10 {t("credit")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
