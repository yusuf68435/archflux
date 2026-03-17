"use client";

import type { CodingConfig } from "@/types/job";

interface CodingOverlayProps {
  config: CodingConfig;
  strokeWidth: number;
  drawingHeight: number;
  drawingMinY: number;
  drawingMaxY: number;
}

export function CodingOverlay({
  config,
  strokeWidth,
  drawingHeight,
  drawingMinY,
  drawingMaxY,
}: CodingOverlayProps) {
  const sw = strokeWidth;
  const circleR = sw * 12;
  const fontSize = sw * 10;
  const extendBy = drawingHeight * 0.08;

  return (
    <g data-layer="CODING_OVERLAY">
      {/* Inner axes (vertical lines) */}
      {config.innerAxes.map((axis, i) => (
        <g key={`inner-${i}`}>
          <line
            x1={axis.x}
            y1={drawingMinY - extendBy}
            x2={axis.x}
            y2={drawingMaxY + extendBy}
            stroke="#f97316"
            strokeWidth={sw}
            strokeDasharray={`${sw * 6} ${sw * 3}`}
            opacity={0.8}
          />
          {/* Label circle at top */}
          <circle
            cx={axis.x}
            cy={drawingMinY - extendBy - circleR * 1.5}
            r={circleR}
            fill="#f97316"
            opacity={0.9}
          />
          <text
            x={axis.x}
            y={drawingMinY - extendBy - circleR * 1.5}
            fill="white"
            fontSize={fontSize}
            textAnchor="middle"
            dominantBaseline="central"
            fontWeight="bold"
          >
            {axis.label}
          </text>
        </g>
      ))}

      {/* Outer axes (horizontal lines) */}
      {config.outerAxes.map((axis, i) => {
        // outerAxis y is in image coordinates, convert to SVG (negate)
        const svgY = -axis.y;
        return (
          <g key={`outer-${i}`}>
            <line
              x1={-extendBy * 2}
              y1={svgY}
              x2={drawingMaxY * 2}
              y2={svgY}
              stroke="#06b6d4"
              strokeWidth={sw}
              strokeDasharray={`${sw * 8} ${sw * 3}`}
              opacity={0.8}
            />
            {/* Label at left */}
            <circle
              cx={-extendBy * 2 - circleR * 1.5}
              cy={svgY}
              r={circleR}
              fill="#06b6d4"
              opacity={0.9}
            />
            <text
              x={-extendBy * 2 - circleR * 1.5}
              y={svgY}
              fill="white"
              fontSize={fontSize * 0.8}
              textAnchor="middle"
              dominantBaseline="central"
              fontWeight="bold"
            >
              {axis.label}
            </text>
          </g>
        );
      })}

      {/* Text annotations */}
      {config.texts.map((t, i) => {
        const svgY = -t.y;
        return (
          <g key={`text-${i}`}>
            {/* Background marker */}
            <circle
              cx={t.x}
              cy={svgY}
              r={sw * 4}
              fill="#a855f7"
              opacity={0.7}
            />
            <text
              x={t.x}
              y={svgY - sw * 8}
              fill="#a855f7"
              fontSize={fontSize}
              textAnchor="middle"
              dominantBaseline="central"
              fontWeight="600"
            >
              {t.value}
            </text>
          </g>
        );
      })}
    </g>
  );
}
