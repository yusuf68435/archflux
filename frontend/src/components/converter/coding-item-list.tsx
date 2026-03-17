"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { CodingConfig } from "@/types/job";

interface CodingItemListProps {
  config: CodingConfig;
  onRemoveInnerAxis: (index: number) => void;
  onUpdateInnerAxisLabel: (index: number, label: string) => void;
  onRemoveOuterAxis: (index: number) => void;
  onUpdateOuterAxisLabel: (index: number, label: string) => void;
  onRemoveText: (index: number) => void;
  onUpdateText: (index: number, updates: Partial<CodingConfig["texts"][0]>) => void;
}

export function CodingItemList({
  config,
  onRemoveInnerAxis,
  onUpdateInnerAxisLabel,
  onRemoveOuterAxis,
  onUpdateOuterAxisLabel,
  onRemoveText,
  onUpdateText,
}: CodingItemListProps) {
  const t = useTranslations("converter.coding");

  return (
    <div className="space-y-4 text-sm overflow-y-auto max-h-[500px]">
      {/* Inner Axes */}
      <div>
        <h4 className="font-medium text-orange-500 mb-2">
          {t("innerAxes")} ({config.innerAxes.length}/30)
        </h4>
        {config.innerAxes.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("placementHint")}</p>
        ) : (
          <div className="space-y-1">
            {config.innerAxes.map((axis, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <input
                  type="text"
                  value={axis.label}
                  onChange={(e) => onUpdateInnerAxisLabel(i, e.target.value)}
                  className="w-12 px-1 py-0.5 text-xs border rounded bg-background"
                />
                <span className="text-xs text-muted-foreground flex-1 truncate">
                  x: {Math.round(axis.x)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  onClick={() => onRemoveInnerAxis(i)}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Outer Axes */}
      <div>
        <h4 className="font-medium text-cyan-500 mb-2">
          {t("outerAxes")} ({config.outerAxes.length}/10)
        </h4>
        {config.outerAxes.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("placementHint")}</p>
        ) : (
          <div className="space-y-1">
            {config.outerAxes.map((axis, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <input
                  type="text"
                  value={axis.label}
                  onChange={(e) => onUpdateOuterAxisLabel(i, e.target.value)}
                  className="w-16 px-1 py-0.5 text-xs border rounded bg-background"
                />
                <span className="text-xs text-muted-foreground flex-1 truncate">
                  y: {Math.round(axis.y)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  onClick={() => onRemoveOuterAxis(i)}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Texts */}
      <div>
        <h4 className="font-medium text-purple-500 mb-2">
          {t("texts")} ({config.texts.length})
        </h4>
        {config.texts.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("placementHint")}</p>
        ) : (
          <div className="space-y-1">
            {config.texts.map((text, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <input
                  type="text"
                  value={text.value}
                  onChange={(e) => onUpdateText(i, { value: e.target.value })}
                  className="flex-1 px-1 py-0.5 text-xs border rounded bg-background"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  onClick={() => onRemoveText(i)}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
