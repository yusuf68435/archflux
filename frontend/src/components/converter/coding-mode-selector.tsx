"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type CodingMode = "auto" | "manual" | "skip";

interface CodingModeSelectorProps {
  onSelect: (mode: CodingMode) => void;
}

export function CodingModeSelector({ onSelect }: CodingModeSelectorProps) {
  const t = useTranslations("converter.coding");

  const options: { mode: CodingMode; icon: string; color: string }[] = [
    { mode: "auto", icon: "⚡", color: "border-cyan-500/50 hover:border-cyan-500" },
    { mode: "manual", icon: "✏️", color: "border-orange-500/50 hover:border-orange-500" },
    { mode: "skip", icon: "⏭️", color: "border-muted hover:border-muted-foreground/50" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("desc")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {options.map(({ mode, icon, color }) => (
          <Card
            key={mode}
            className={`cursor-pointer transition-all border-2 ${color}`}
            onClick={() => onSelect(mode)}
          >
            <CardContent className="pt-6 text-center space-y-3">
              <div className="text-3xl">{icon}</div>
              <h3 className="font-semibold">{t(`${mode}Option`)}</h3>
              <p className="text-sm text-muted-foreground">{t(`${mode}Desc`)}</p>
              <Badge variant={mode === "skip" ? "secondary" : "default"}>
                {mode === "auto" ? t("extraCredit") : t("free")}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
