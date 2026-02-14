"use client";

import React, { useRef, useState, useEffect } from "react";
import FrameDiagramOverlay, { MemberDiagramData } from "./FrameDiagramOverlay";
import { ForceUnit, MomentUnit } from "@/utils/unitUtils";

type Point = { x: number; y: number };
type SupportType = "None" | "Fixed" | "Pinned" | "Roller";
type LoadType = "Point" | "UDL" | "VDL";

export interface Load {
  id: string;
  type: LoadType;
  value: number;
  position?: number;
  span?: number;
  angle?: number;
  // VDL specific
  highValue?: number;
  highPosition?: number;
  lowPosition?: number;
}

export interface Member {
  startNode: Point;
  endNode: Point;
  memberType?: string;
  workflowMode?: "analysis" | "design";
  includeSettlements?: boolean;
  supports: {
    start: SupportType;
    end: SupportType;
    startSettlement?: number;
    endSettlement?: number;
  };
  loads: Load[];
  Ecoef?: number;
  Icoef?: number;
  b?: number;
  h?: number;
  slabThickness?: number;
}

interface StructurePreviewProps {
  members: Member[];
  highlightNode?: { x: number; y: number } | null;
  diagramData?: MemberDiagramData[];
  activeDiagram?: "bmd" | "sfd" | "both" | "none";
  diagramUnits?: { momentUnit: MomentUnit; shearUnit: ForceUnit };
  hideLoads?: boolean;
  autoHeight?: boolean;
}

export default function StructurePreview({
  members,
  highlightNode,
  diagramData = [],
  activeDiagram = "none",
  diagramUnits = { momentUnit: "kN*m", shearUnit: "kN" },
  hideLoads = false,
  autoHeight = false,
}: StructurePreviewProps) {
  const containerRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      });
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  const padding = 60;
  const width = dimensions.width || 800;
  const height = dimensions.height || 400;

  // Find bounds for scaling
  const allNodes = members.flatMap((m) => [m.startNode, m.endNode]);
  let minX = Math.min(0, ...allNodes.map((n) => Number(n.x || 0)));
  let maxX = Math.max(10, ...allNodes.map((n) => Number(n.x || 0)));
  let minY = Math.min(0, ...allNodes.map((n) => Number(n.y || 0)));
  let maxY = Math.max(0, ...allNodes.map((n) => Number(n.y || 0)));

  // Expand bounds to fit diagrams if active
  if (activeDiagram !== "none" && members.length > 0) {
    const memberLengths = members.map((m) => {
      const dx = m.endNode.x - m.startNode.x;
      const dy = m.endNode.y - m.startNode.y;
      return Math.sqrt(dx * dx + dy * dy);
    });
    const minLength = Math.min(...memberLengths) || 1;
    // Diagram height is roughly 0.3 * minLength.
    // We add 0.5 * minLength padding to be safe for labels and peaks.
    const diagramMargin = minLength * 0.5;

    minX -= diagramMargin;
    maxX += diagramMargin;
    minY -= diagramMargin;
    maxY += diagramMargin;
  }

  const availableWidth = width - 2 * padding;
  // For autoHeight, we don't constrain by available height initially
  const availableHeight = autoHeight ? Infinity : height - 2 * padding;

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  // Uniform Scaling logic
  let scale = 1;
  if (autoHeight) {
    // If autoHeight, scale to fit width, but respect a max scale to prevent huge elements
    scale = availableWidth / rangeX;
    // Optional: clamp scale if needed, or let it be large
  } else {
    scale = Math.min(availableWidth / rangeX, availableHeight / rangeY);
  }

  // Calculate actual height needed if autoHeight
  const contentHeight = rangeY * scale + 2 * padding;
  const finalHeight = autoHeight ? Math.max(contentHeight, 400) : height;

  const centerX = padding + (availableWidth - rangeX * scale) / 2;
  const centerY =
    padding +
    ((autoHeight ? finalHeight - 2 * padding : availableHeight) -
      rangeY * scale) /
      2;

  const scaleX = (x: number) => {
    const val = Number(x || 0);
    return centerX + (val - minX) * scale;
  };
  const scaleY = (y: number) => {
    const val = Number(y || 0);
    // Invert Y for SVG (Y grows downwards)
    return height - centerY - (val - minY) * scale;
  };

  const renderSupport = (
    type: SupportType,
    x: number,
    y: number,
    key: string,
  ) => {
    const px = scaleX(x);
    const py = scaleY(y);

    if (type === "Pinned") {
      return (
        <path
          key={key}
          d={`M ${px - 10} ${py + 15} L ${px + 10} ${py + 15} L ${px} ${py} Z`}
          fill="none"
          stroke="var(--support)"
          strokeWidth="2"
          className="drop-shadow-[0_0_5px_var(--support-glow)]"
        />
      );
    }
    if (type === "Fixed") {
      return (
        <line
          key={key}
          x1={px - 15}
          y1={py}
          x2={px + 15}
          y2={py}
          stroke="var(--support)"
          strokeWidth="4"
          className="drop-shadow-[0_0_5px_var(--support-glow)]"
        />
      );
    }
    if (type === "Roller") {
      return (
        <g key={key}>
          <circle
            cx={px}
            cy={py + 5}
            r="5"
            fill="none"
            stroke="var(--support)"
            strokeWidth="2"
          />
          <line
            x1={px - 10}
            y1={py + 10}
            x2={px + 10}
            y2={py + 10}
            stroke="var(--support)"
            strokeWidth="2"
          />
        </g>
      );
    }
    return null;
  };

  const idPrefix = React.useId().replace(/:/g, "");

  return (
    <div
      className={`w-full ${autoHeight ? "" : "h-full"} relative overflow-hidden flex items-center justify-center p-4`}
      style={{ height: autoHeight ? finalHeight : "100%" }}
    >
      <svg
        ref={containerRef}
        viewBox={`0 0 ${width} ${autoHeight ? finalHeight : height}`}
        className={`w-full ${autoHeight ? "" : "h-full"}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id={`${idPrefix}-glow`}>
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Dynamic Grid */}
        <g stroke="white" strokeWidth="0.5" strokeOpacity="0.05">
          {Array.from({ length: 11 }).map((_, i) => {
            const x = minX + (i / 10) * rangeX;
            const px = scaleX(x);
            return <line key={`gx-${i}`} x1={px} y1="0" x2={px} y2={height} />;
          })}
          {Array.from({ length: 5 }).map((_, i) => {
            const y = minY + (i / 4) * rangeY;
            const py = scaleY(y);
            return <line key={`gy-${i}`} x1="0" y1={py} x2={width} y2={py} />;
          })}
        </g>

        {/* Origin Axes */}
        <g stroke="white" strokeWidth="1" strokeOpacity="0.1">
          <line x1={scaleX(0)} y1="0" x2={scaleX(0)} y2={height} />
          <line x1="0" y1={scaleY(0)} x2={width} y2={scaleY(0)} />
        </g>

        {members.map((member, i) => {
          const x1 = scaleX(member.startNode.x);
          const y1 = scaleY(member.startNode.y);
          const x2 = scaleX(member.endNode.x);
          const y2 = scaleY(member.endNode.y);

          const dx_px = x2 - x1;
          const dy_px = y2 - y1;
          const length_px = Math.sqrt(dx_px * dx_px + dy_px * dy_px) || 1;

          return (
            <g key={i}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="var(--primary)"
                strokeWidth="4"
                strokeLinecap="round"
                className="drop-shadow-[0_0_8px_var(--primary-glow)]"
              />

              {/* Supports */}
              {renderSupport(
                member.supports.start,
                member.startNode.x,
                member.startNode.y,
                `support-start-${i}`,
              )}
              {renderSupport(
                member.supports.end,
                member.endNode.x,
                member.endNode.y,
                `support-end-${i}`,
              )}

              {/* Loads */}
              {!hideLoads &&
                member.loads.map((load, j) => {
                  const loadVal = Number(load.value || 0).toFixed(1);
                  const angle = (load.angle ?? 90) * (Math.PI / 180); // Radians, default 90 (down)

                  if (load.type === "Point") {
                    const mLen =
                      Math.sqrt(
                        Math.pow(member.endNode.x - member.startNode.x, 2) +
                          Math.pow(member.endNode.y - member.startNode.y, 2),
                      ) || 1;
                    const t = Number(load.position || 0) / mLen;
                    const x = x1 + (x2 - x1) * t;
                    const y = y1 + (y2 - y1) * t;

                    const arrowLength = 40;
                    const headLen = 10;
                    const headWidth = 6;
                    const dx_load = Math.cos(angle) * arrowLength;
                    const dy_load = Math.sin(angle) * arrowLength;

                    // Manual Head Points
                    const bx = x - Math.cos(angle) * headLen;
                    const by = y - Math.sin(angle) * headLen;
                    const p1x = bx + Math.sin(angle) * (headWidth / 2);
                    const p1y = by - Math.cos(angle) * (headWidth / 2);
                    const p2x = bx - Math.sin(angle) * (headWidth / 2);
                    const p2y = by + Math.cos(angle) * (headWidth / 2);

                    return (
                      <g
                        key={`load-${i}-${j}`}
                        className="text-[var(--accent)]"
                      >
                        <line
                          x1={x - dx_load}
                          y1={y - dy_load}
                          x2={bx}
                          y2={by}
                          stroke="currentColor"
                          strokeWidth="2"
                          className="drop-shadow-[0_0_3px_var(--accent-glow)]"
                        />
                        <polygon
                          points={`${x},${y} ${p1x},${p1y} ${p2x},${p2y}`}
                          fill="currentColor"
                        />
                        <text
                          x={x - dx_load * 1.3}
                          y={y - dy_load * 1.3}
                          textAnchor="middle"
                          fill="currentColor"
                          fontSize="10"
                          fontWeight="bold"
                          dominantBaseline="middle"
                        >
                          {loadVal}kN
                        </text>
                      </g>
                    );
                  }

                  if (load.type === "UDL") {
                    const mLen =
                      Math.sqrt(
                        Math.pow(member.endNode.x - member.startNode.x, 2) +
                          Math.pow(member.endNode.y - member.startNode.y, 2),
                      ) || 1;
                    const tS = Number(load.position || 0) / mLen;
                    const tE =
                      (Number(load.position || 0) + Number(load.span || 0)) /
                      mLen;

                    const xS = x1 + (x2 - x1) * tS;
                    const yS = y1 + (y2 - y1) * tS;
                    const xE = x1 + (x2 - x1) * tE;
                    const yE = y1 + (y2 - y1) * tE;

                    const sSpan =
                      Math.sqrt(Math.pow(xE - xS, 2) + Math.pow(yE - yS, 2)) ||
                      1;
                    const arrowLength = 30;
                    const headLen = 8;
                    const headWidth = 5;
                    const dx_load = Math.cos(angle) * arrowLength;
                    const dy_load = Math.sin(angle) * arrowLength;

                    const density = Math.max(2, Math.floor(sSpan / 25));

                    return (
                      <g key={`load-${i}-${j}`}>
                        {/* UDL Base Line */}
                        <line
                          x1={xS - dx_load}
                          y1={yS - dy_load}
                          x2={xE - dx_load}
                          y2={yE - dy_load}
                          stroke="var(--accent)"
                          strokeWidth="1.5"
                          strokeOpacity="0.5"
                        />
                        {/* Distributed Arrows */}
                        {Array.from({ length: density }).map((_, k) => {
                          const pos = k / (density - 1);
                          const px = xS + pos * (xE - xS);
                          const py = yS + pos * (yE - yS);

                          // Manual Head Points
                          const bx = px - Math.cos(angle) * headLen;
                          const by = py - Math.sin(angle) * headLen;
                          const p1x = bx + Math.sin(angle) * (headWidth / 2);
                          const p1y = by - Math.cos(angle) * (headWidth / 2);
                          const p2x = bx - Math.sin(angle) * (headWidth / 2);
                          const p2y = by + Math.cos(angle) * (headWidth / 2);

                          return (
                            <g key={k} className="text-[var(--accent)]">
                              <line
                                x1={px - dx_load}
                                y1={py - dy_load}
                                x2={bx}
                                y2={by}
                                stroke="currentColor"
                                strokeWidth="1"
                              />
                              <polygon
                                points={`${px},${py} ${p1x},${p1y} ${p2x},${p2y}`}
                                fill="currentColor"
                              />
                            </g>
                          );
                        })}
                        {/* Label */}
                        <g
                          transform={`translate(${(xS + xE) / 2 - dx_load * 1.6}, ${(yS + yE) / 2 - dy_load * 1.6})`}
                        >
                          <rect
                            x="-25"
                            y="-12"
                            width="50"
                            height="15"
                            rx="4"
                            fill="#000"
                          />
                          <text
                            textAnchor="middle"
                            fill="var(--accent)"
                            fontSize="8"
                            fontWeight="bold"
                            dominantBaseline="middle"
                          >
                            {loadVal}kN/m
                          </text>
                        </g>
                      </g>
                    );
                  }

                  if (load.type === "VDL") {
                    const mLen =
                      Math.sqrt(
                        Math.pow(member.endNode.x - member.startNode.x, 2) +
                          Math.pow(member.endNode.y - member.startNode.y, 2),
                      ) || 1;
                    const lowPos = Number(load.lowPosition ?? 0);
                    const highPos = Number(load.highPosition ?? 0);
                    const highVal = Number(load.highValue ?? 0);

                    const tS = Math.min(lowPos, highPos) / mLen;
                    const tE = Math.max(lowPos, highPos) / mLen;

                    const xS = x1 + (x2 - x1) * tS;
                    const yS = y1 + (y2 - y1) * tS;
                    const xE = x1 + (x2 - x1) * tE;
                    const yE = y1 + (y2 - y1) * tE;

                    const sSpan =
                      Math.sqrt(Math.pow(xE - xS, 2) + Math.pow(yE - yS, 2)) ||
                      1;
                    const arrowLengthIdx = 30; // Max length at peak
                    const density = Math.max(2, Math.floor(sSpan / 25));

                    return (
                      <g key={`load-${i}-${j}`}>
                        {/* VDL Base Line (Diagonal) */}
                        <line
                          x1={
                            x1 +
                            (x2 - x1) * (highPos / mLen) -
                            Math.cos(angle) * arrowLengthIdx
                          }
                          y1={
                            y1 +
                            (y2 - y1) * (highPos / mLen) -
                            Math.sin(angle) * arrowLengthIdx
                          }
                          x2={x1 + (x2 - x1) * (lowPos / mLen)}
                          y2={y1 + (y2 - y1) * (lowPos / mLen)}
                          stroke="var(--accent)"
                          strokeWidth="1.5"
                          strokeOpacity="0.5"
                        />
                        {/* Distributed Arrows with Varying Length */}
                        {Array.from({ length: density }).map((_, k) => {
                          const t = k / (density - 1);
                          const currentPos = lowPos + t * (highPos - lowPos);
                          const px = x1 + (x2 - x1) * (currentPos / mLen);
                          const py = y1 + (y2 - y1) * (currentPos / mLen);

                          const currentArrowLen = t * arrowLengthIdx;
                          const headLen = Math.min(8, currentArrowLen);
                          const headWidth = Math.min(5, currentArrowLen * 0.6);

                          const dx_load = Math.cos(angle) * currentArrowLen;
                          const dy_load = Math.sin(angle) * currentArrowLen;

                          const bx = px - Math.cos(angle) * headLen;
                          const by = py - Math.sin(angle) * headLen;
                          const p1x = bx + Math.sin(angle) * (headWidth / 2);
                          const p1y = by - Math.cos(angle) * (headWidth / 2);
                          const p2x = bx - Math.sin(angle) * (headWidth / 2);
                          const p2y = by + Math.cos(angle) * (headWidth / 2);

                          if (currentArrowLen < 1) return null;

                          return (
                            <g key={k} className="text-[var(--accent)]">
                              <line
                                x1={px - dx_load}
                                y1={py - dy_load}
                                x2={bx}
                                y2={by}
                                stroke="currentColor"
                                strokeWidth="1"
                              />
                              <polygon
                                points={`${px},${py} ${p1x},${p1y} ${p2x},${p2y}`}
                                fill="currentColor"
                              />
                            </g>
                          );
                        })}
                        {/* Label at Peak */}
                        <g
                          transform={`translate(${x1 + (x2 - x1) * (highPos / mLen) - Math.cos(angle) * arrowLengthIdx * 1.5}, ${y1 + (y2 - y1) * (highPos / mLen) - Math.sin(angle) * arrowLengthIdx * 1.5})`}
                        >
                          <rect
                            x="-25"
                            y="-12"
                            width="50"
                            height="15"
                            rx="4"
                            fill="#000"
                          />
                          <text
                            textAnchor="middle"
                            fill="var(--accent)"
                            fontSize="8"
                            fontWeight="bold"
                            dominantBaseline="middle"
                          >
                            {highVal.toFixed(1)}kN/m
                          </text>
                        </g>
                      </g>
                    );
                  }
                  return null;
                })}

              {/* Node Indicators */}
              <circle
                cx={x1}
                cy={y1}
                r="4"
                fill="#050505"
                stroke="var(--primary)"
                strokeWidth="2"
              />
              <circle
                cx={x2}
                cy={y2}
                r="4"
                fill="#050505"
                stroke="var(--primary)"
                strokeWidth="2"
              />
            </g>
          );
        })}

        {/* Diagram Overlay (BMD/SFD on members) */}
        {diagramData.length > 0 && activeDiagram !== "none" && (
          <FrameDiagramOverlay
            members={members}
            diagramData={diagramData}
            scaleX={scaleX}
            scaleY={scaleY}
            scale={scale}
            activeDiagram={activeDiagram}
            diagramUnits={diagramUnits}
          />
        )}

        {/* Focus Highlight */}
        {highlightNode && (
          <g>
            <circle
              cx={scaleX(highlightNode.x)}
              cy={scaleY(highlightNode.y)}
              r="12"
              fill="var(--primary)"
              fillOpacity="0.15"
              className="animate-pulse"
            />
            <circle
              cx={scaleX(highlightNode.x)}
              cy={scaleY(highlightNode.y)}
              r="8"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="1.5"
              strokeDasharray="4 2"
              className="animate-spin-slow"
            />
            <circle
              cx={scaleX(highlightNode.x)}
              cy={scaleY(highlightNode.y)}
              r="3"
              fill="var(--primary)"
              className="drop-shadow-[0_0_8px_var(--primary-glow)]"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
