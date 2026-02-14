"use client";

import React from "react";
import { Member } from "./StructurePreview";
import {
  convertForce,
  convertMoment,
  ForceUnit,
  MomentUnit,
} from "@/utils/unitUtils";

export interface DiagramDataPoint {
  x: number;
  shear: number;
  moment: number;
  axial: number;
}

export interface MemberDiagramData {
  memberIndex: number;
  data: DiagramDataPoint[];
}

interface FrameDiagramOverlayProps {
  members: Member[];
  diagramData: MemberDiagramData[];
  scaleX: (x: number) => number;
  scaleY: (y: number) => number;
  scale: number;
  activeDiagram: 'bmd' | 'sfd' | 'both' | 'none';
  diagramUnits: { momentUnit: MomentUnit; shearUnit: ForceUnit };
}

/**
 * SVG overlay component that draws BMD and SFD diagrams
 * directly on frame members, following each member's orientation.
 */
export default function FrameDiagramOverlay({
  members,
  diagramData,
  scaleX,
  scaleY,
  scale,
  activeDiagram,
  diagramUnits,
}: FrameDiagramOverlayProps) {
  if (activeDiagram === 'none' || !diagramData.length) return null;

  // Calculate diagram scaling factor based on max values
  const allMoments = diagramData.flatMap(d => d.data.map(p => Math.abs(p.moment)));
  const allShears = diagramData.flatMap(d => d.data.map(p => Math.abs(p.shear)));
  const maxMoment = Math.max(...allMoments, 1);
  const maxShear = Math.max(...allShears, 1);

  // Scale factor to make diagrams visible (relative to shortest member)
  const memberLengths = members.map(m => {
    const dx = m.endNode.x - m.startNode.x;
    const dy = m.endNode.y - m.startNode.y;
    return Math.sqrt(dx * dx + dy * dy);
  });
  const minLength = Math.min(...memberLengths) || 1;
  
  // Diagram height relative to member length (max 30% of shortest member)
  const diagramScale = (minLength * 0.3);

  const renderMemberDiagram = (
    member: Member,
    memberData: MemberDiagramData,
    memberIndex: number
  ) => {
    const { data } = memberData;
    if (!data.length) return null;

    // Member geometry
    const dx = member.endNode.x - member.startNode.x;
    const dy = member.endNode.y - member.startNode.y;
    const L = Math.sqrt(dx * dx + dy * dy) || 1;

    // Members' scaled positions
    const x1 = scaleX(member.startNode.x);
    const y1 = scaleY(member.startNode.y);
    const x2 = scaleX(member.endNode.x);
    const y2 = scaleY(member.endNode.y);

    // Unit vectors along and perpendicular to member
    // Along member (from start to end in SVG coords)
    const alongX = (x2 - x1) / (L * scale);
    const alongY = (y2 - y1) / (L * scale);

    // Perpendicular to member (rotated 90° CCW in SVG coords)
    // For SVG: Y increases downward, so perpendicular is (-alongY, alongX)
    const perpX = -alongY;
    const perpY = alongX;

    // Generate path for BMD
    const generatePath = (
      dataKey: 'moment' | 'shear',
      maxValue: number,
      color: string,
      fillColor: string
    ) => {
      if (data.length < 2) return null;

      const scaleFactor = (diagramScale * scale) / maxValue;

      // Filter out duplicate x positions (keep only the last value at each x)
      // This removes the "before jump" points that cause parallel lines
      const filteredData = data.filter((point, idx, arr) => {
        // Keep this point if it's the last one, or if the next point has a different x
        if (idx === arr.length - 1) return true;
        return Math.abs(point.x - arr[idx + 1].x) > 1e-6;
      });

      // Build SVG path for filled area (closed polygon)
      const fillPoints: string[] = [];
      // Build SVG path for stroke (only the curve)
      const curvePoints: string[] = [];
      
      // Start fill at member start point
      fillPoints.push(`M ${x1} ${y1}`);

      // Draw to each data point with perpendicular offset
      filteredData.forEach((point, idx) => {
        const t = point.x / L; // Parameter along member (0 to 1)
        const value = point[dataKey];

        // Position along member
        const baseX = x1 + t * (x2 - x1);
        const baseY = y1 + t * (y2 - y1);

        // Offset perpendicular to member (negative for BMD convention)
        const offset = -value * scaleFactor;
        const px = baseX + perpX * offset;
        const py = baseY + perpY * offset;

        fillPoints.push(`L ${px.toFixed(2)} ${py.toFixed(2)}`);
        
        // For the curve stroke
        if (idx === 0) {
          curvePoints.push(`M ${px.toFixed(2)} ${py.toFixed(2)}`);
        } else {
          curvePoints.push(`L ${px.toFixed(2)} ${py.toFixed(2)}`);
        }
      });

      // Close fill path back to member end
      fillPoints.push(`L ${x2} ${y2}`);
      fillPoints.push('Z');

      // --- Labeling Logic ---
      const labels: { x: number; y: number; value: number; type: 'max' | 'min' | 'end' | 'inflection' }[] = [];
      
      // 1. Endpoints
      if (filteredData.length > 0) {
        const start = filteredData[0];
        const end = filteredData[filteredData.length - 1];
        if (Math.abs(start[dataKey]) > 0.1) labels.push({ ...getScreenCoords(start, dataKey, scaleFactor), value: start[dataKey], type: 'end' });
        if (Math.abs(end[dataKey]) > 0.1) labels.push({ ...getScreenCoords(end, dataKey, scaleFactor), value: end[dataKey], type: 'end' });
      }

      // 2. Max/Min (Local Extrema)
      let maxVal = -Infinity;
      let minVal = Infinity;
      filteredData.forEach(p => {
        if (p[dataKey] > maxVal) maxVal = p[dataKey];
        if (p[dataKey] < minVal) minVal = p[dataKey];
      });

      // Find points matching max/min
      filteredData.forEach((p, i) => {
        // Simple peak detection: strictly greater than neighbors (or equal for flat peaks)
        // For simplicity, just labeling the absolute global max/min of the span for now, or distinct local peaks?
        // Let's label the global Max and Min for the member
        if (Math.abs(p[dataKey] - maxVal) < 0.001 && Math.abs(maxVal) > 0.1) {
            // Check if we already have a label close to this X
            if (!labels.some(l => Math.abs(l.x - getScreenCoords(p, dataKey, scaleFactor).x) < 5)) {
                labels.push({ ...getScreenCoords(p, dataKey, scaleFactor), value: p[dataKey], type: 'max' });
            }
        }
         if (Math.abs(p[dataKey] - minVal) < 0.001 && Math.abs(minVal) > 0.1) {
             if (!labels.some(l => Math.abs(l.x - getScreenCoords(p, dataKey, scaleFactor).x) < 5)) {
                labels.push({ ...getScreenCoords(p, dataKey, scaleFactor), value: p[dataKey], type: 'min' });
            }
        }
      });

      // 3. Inflection Points (Zero Crossings)
      for (let i = 0; i < filteredData.length - 1; i++) {
        const p1 = filteredData[i];
        const p2 = filteredData[i+1];
        if ((p1[dataKey] > 0 && p2[dataKey] < 0) || (p1[dataKey] < 0 && p2[dataKey] > 0)) {
          // Zero crossing found
          // Interpolate to find exact x where value is 0
          const fraction = Math.abs(p1[dataKey]) / (Math.abs(p1[dataKey]) + Math.abs(p2[dataKey]));
          const zeroX = p1.x + fraction * (p2.x - p1.x);
          
          // Only add if not too close to ends (already labeled)
          if (zeroX > 0.1 && zeroX < L - 0.1) {
             // Calculate screen coords for the zero point on the member (offset 0)
             // We can use a helper, but need to reconstruct the point
             const t = zeroX / L;
             const baseX = x1 + t * (x2 - x1);
             const baseY = y1 + t * (y2 - y1);
             labels.push({ x: baseX, y: baseY, value: 0, type: 'inflection' });
          }
        }
      }

      return (
        <g key={`${memberIndex}-${dataKey}`}>
          {/* Filled area */}
          <path
            d={fillPoints.join(' ')}
            fill={fillColor}
            stroke="none"
            fillOpacity={0.4}
          />
          {/* Curve outline only */}
          <path
            d={curvePoints.join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          
          {/* Labels */}
          {labels.map((label, i) => (
             <g key={`label-${i}`}>
                {label.type === 'inflection' ? (
                   <circle cx={label.x} cy={label.y} r={2} fill="#ef4444" stroke="white" strokeWidth={1} />
                ) : (
                   <circle cx={label.x} cy={label.y} r={3} fill={color} stroke="white" strokeWidth={1} />
                )}
                
	                {label.type !== 'inflection' && (
	                    <g>
	                        <rect 
                            x={label.x + perpX * 8 - 14} 
                            y={label.y + perpY * 8 - 9} 
                            width="28" 
                            height="18" 
                            rx="4" 
                            fill="rgba(0,0,0,0.7)" 
                        />
	                        <text
	                        x={label.x + perpX * 8}
	                        y={label.y + perpY * 8}
	                        fill="white"
	                        fontSize="9"
	                        fontWeight="bold"
	                        textAnchor="middle"
	                        dominantBaseline="middle"
	                        >
	                        {(dataKey === "moment"
                            ? convertMoment(
                                label.value,
                                "kN*m",
                                diagramUnits.momentUnit,
                              )
                            : convertForce(
                                label.value,
                                "kN",
                                diagramUnits.shearUnit,
                              )
                          ).toFixed(1)}
	                        </text>
	                    </g>
	                )}
             </g>
          ))}
        </g>
      );
    };

    // Helper to get screen coordinates for a point
    const getScreenCoords = (point: DiagramDataPoint, key: 'moment' | 'shear', sFactor: number) => {
        const t = point.x / L;
        const baseX = x1 + t * (x2 - x1);
        const baseY = y1 + t * (y2 - y1);
        const offset = -point[key] * sFactor;
        return {
            x: baseX + perpX * offset,
            y: baseY + perpY * offset
        };
    };

    return (
      <g key={`member-${memberIndex}`}>
        {/* BMD */}
        {(activeDiagram === 'bmd' || activeDiagram === 'both') &&
          generatePath('moment', maxMoment, '#3b82f6', 'rgba(59, 130, 246, 0.15)')}
        
        {/* SFD */}
        {(activeDiagram === 'sfd' || activeDiagram === 'both') &&
          generatePath('shear', maxShear, '#10b981', 'rgba(16, 185, 129, 0.15)')}
      </g>
    );
  };

  return (
    <g className="diagram-overlay">
      {members.map((member, index) => {
        const memberData = diagramData.find(d => d.memberIndex === index);
        if (!memberData) return null;
        return renderMemberDiagram(member, memberData, index);
      })}
    </g>
  );
}

