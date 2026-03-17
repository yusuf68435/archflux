"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type CodingTool = "innerAxis" | "outerAxis" | "text" | "select" | null;

interface CodingToolbarProps {
  activeTool: CodingTool;
  onToolChange: (tool: CodingTool) => void;
  innerAxisCount: number;
  outerAxisCount: number;
}

const tools: { key: CodingTool; icon: string }[] = [
  { key: "innerAxis", icon: "↕" },
  { key: "outerAxis", icon: "↔" },
  { key: "text", icon: "T" },
  { key: "select", icon: "↖" },
];

export function CodingToolbar({
  activeTool,
  onToolChange,
  innerAxisCount,
  outerAxisCount,
}: CodingToolbarProps) {
  const t = useTranslations("converter.coding");

  return (
    <div className="flex flex-col gap-1">
      {tools.map(({ key, icon }) => {
        const isActive = activeTool === key;
        const isDisabled =
          (key === "innerAxis" && innerAxisCount >= 30) ||
          (key === "outerAxis" && outerAxisCount >= 10);

        return (
          <Button
            key={key}
            variant={isActive ? "default" : "outline"}
            size="sm"
            className="w-full justify-start gap-2"
            disabled={isDisabled}
            onClick={() => onToolChange(isActive ? null : key)}
            title={
              isDisabled
                ? key === "innerAxis"
                  ? t("maxInnerAxes")
                  : t("maxOuterAxes")
                : undefined
            }
          >
            <span className="font-mono text-base w-5 text-center">{icon}</span>
            <span className="text-xs">{t(`tools.${key}`)}</span>
          </Button>
        );
      })}
    </div>
  );
}
