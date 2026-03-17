"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DxfViewer } from "./dxf-viewer";
import { CodingToolbar } from "./coding-toolbar";
import { CodingItemList } from "./coding-item-list";
import { useConverterStore } from "@/stores/converter-store";

interface ManualCodingEditorProps {
  dxfUrl: string;
  onApply: () => void;
  onCancel: () => void;
  isApplying?: boolean;
}

export function ManualCodingEditor({
  dxfUrl,
  onApply,
  onCancel,
  isApplying = false,
}: ManualCodingEditorProps) {
  const t = useTranslations("converter.coding");
  const [textPromptPos, setTextPromptPos] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState("");

  const {
    codingTool,
    setCodingTool,
    codingConfig,
    addInnerAxis,
    removeInnerAxis,
    updateInnerAxisLabel,
    addOuterAxis,
    removeOuterAxis,
    updateOuterAxisLabel,
    addText,
    removeText,
    updateText,
  } = useConverterStore();

  const handleSvgClick = useCallback(
    (svgX: number, svgY: number) => {
      if (!codingTool || codingTool === "select") return;

      // svgY is in SVG space (negated CAD). For inner axis we need X position.
      // For outer axis we need image Y = -svgY (since svgY = -imageY in dxf-to-svg)
      // Actually the backend expects image coordinates for the coding config.

      switch (codingTool) {
        case "innerAxis":
          // X position is the same in SVG and image space
          addInnerAxis(svgX, "");
          break;
        case "outerAxis":
          // Convert SVG Y to image Y: imageY = -svgY
          addOuterAxis(-svgY, "");
          break;
        case "text":
          // Show text input prompt
          setTextPromptPos({ x: svgX, y: -svgY });
          setTextInput("");
          break;
      }
    },
    [codingTool, addInnerAxis, addOuterAxis]
  );

  const handleTextSubmit = useCallback(() => {
    if (textPromptPos && textInput.trim()) {
      addText(textPromptPos.x, textPromptPos.y, textInput.trim());
    }
    setTextPromptPos(null);
    setTextInput("");
  }, [textPromptPos, textInput, addText]);

  const hasItems =
    codingConfig.innerAxes.length > 0 ||
    codingConfig.outerAxes.length > 0 ||
    codingConfig.texts.length > 0;

  return (
    <div className="space-y-4">
      {/* Text input prompt */}
      {textPromptPos && (
        <div className="flex items-center gap-2 p-3 rounded-lg border bg-purple-50 dark:bg-purple-950/30">
          <span className="text-sm font-medium">{t("enterText")}:</span>
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTextSubmit();
              if (e.key === "Escape") setTextPromptPos(null);
            }}
            className="flex-1 px-2 py-1 text-sm border rounded bg-background"
            autoFocus
          />
          <Button size="sm" onClick={handleTextSubmit} disabled={!textInput.trim()}>
            OK
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setTextPromptPos(null)}>
            ×
          </Button>
        </div>
      )}

      <div className="flex gap-4">
        {/* Left: Toolbar */}
        <div className="w-36 shrink-0">
          <CodingToolbar
            activeTool={codingTool}
            onToolChange={setCodingTool}
            innerAxisCount={codingConfig.innerAxes.length}
            outerAxisCount={codingConfig.outerAxes.length}
          />
          <p className="text-xs text-muted-foreground mt-3">
            {codingTool && codingTool !== "select"
              ? t("placementHint")
              : t("panHint")}
          </p>
        </div>

        {/* Center: Viewer */}
        <div className="flex-1 min-w-0">
          <DxfViewer
            dxfUrl={dxfUrl}
            overlayConfig={codingConfig}
            interactionMode={codingTool && codingTool !== "select" ? "place" : "pan"}
            onSvgClick={handleSvgClick}
            showLayers={false}
            height={550}
          />
        </div>

        {/* Right: Item List */}
        <div className="w-52 shrink-0">
          <CodingItemList
            config={codingConfig}
            onRemoveInnerAxis={removeInnerAxis}
            onUpdateInnerAxisLabel={updateInnerAxisLabel}
            onRemoveOuterAxis={removeOuterAxis}
            onUpdateOuterAxisLabel={updateOuterAxisLabel}
            onRemoveText={removeText}
            onUpdateText={updateText}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={isApplying}>
          {t("cancel")}
        </Button>
        <Button onClick={onApply} disabled={!hasItems || isApplying}>
          {isApplying ? t("applying") : t("apply")}
        </Button>
      </div>
    </div>
  );
}
