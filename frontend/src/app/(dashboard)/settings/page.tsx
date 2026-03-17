"use client";

import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const { data: session } = useSession();
  const user = session?.user;

  const updateSetting = async (key: string, value: string) => {
    const res = await fetch("/api/user/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    if (res.ok) {
      toast.success(t("settingUpdated"));
      // If locale changed, set cookie and reload
      if (key === "locale") {
        document.cookie = `locale=${value};path=/;max-age=31536000`;
        window.location.reload();
      }
    } else {
      toast.error(t("settingError"));
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>{t("email")}</Label>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div className="grid gap-2">
            <Label>{t("name")}</Label>
            <p className="text-sm text-muted-foreground">{user?.name || t("notSpecified")}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("preferences")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>{t("language")}</Label>
            <Select
              defaultValue={(user as Record<string, unknown>)?.locale as string || "tr"}
              onValueChange={(v) => v && updateSetting("locale", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tr">Türkçe</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>{t("themeLabel")}</Label>
            <Select
              defaultValue={(user as Record<string, unknown>)?.theme as string || "SYSTEM"}
              onValueChange={(v) => v && updateSetting("theme", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LIGHT">{t("theme.light")}</SelectItem>
                <SelectItem value="DARK">{t("theme.dark")}</SelectItem>
                <SelectItem value="SYSTEM">{t("theme.system")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("about")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>ArchFlux v1.0.0</p>
          <p>{t("aboutDesc")}</p>
          <p>{t("support")}: support@archflux.app</p>
        </CardContent>
      </Card>
    </div>
  );
}
