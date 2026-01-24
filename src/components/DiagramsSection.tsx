"use client";

import { useMemo } from "react";
import { Member } from "./StructurePreview";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend
} from 'recharts';
import { calculateDiagramData } from "@/utils/diagramUtils";

interface DiagramsSectionProps {
  members: Member[];
  solveResults: {
    endMoments: { span: string; left: number; right: number }[];
  } | null;
}

export default function DiagramsSection({ members, solveResults }: DiagramsSectionProps) {

  // Return null if no results
  if (!solveResults || !members.length) return null;

  // Calculate all diagram data for all members
  const allDiagramData = useMemo(() => {
    return members.map((member, index) => {
      const moments = solveResults.endMoments[index];
      console.log(`[DiagramsSection] Span ${index} Inputs:`, {
        memberId: `M${index + 1}`,
        leftMoment: moments?.left,
        rightMoment: moments?.right,
        loads: member.loads
      });
      const data = calculateDiagramData(
        member, 
        { leftMoment: moments?.left || 0, rightMoment: moments?.right || 0 }
      );
      console.log(`[DiagramsSection] Span ${index} Calculated Data (first/last):`, {
        first: data[0],
        last: data[data.length - 1]
      });
      return {
        spanIndex: index,
        data
      };
    });
  }, [members, solveResults]);

  // Colors for different spans
  const spanColors = [
    { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.2)' }, // Emerald
    { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.2)' },  // Blue
    { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.2)' },  // Amber
    { stroke: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.2)' },  // Violet
    { stroke: '#ec4899', fill: 'rgba(236, 72, 153, 0.2)' },  // Pink
    { stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.2)' },   // Cyan
  ];

  // Combine data from all spans for each diagram type
  const combinedData = useMemo(() => {
    const combined: any[] = [];
    let currentXOffset = 0;

    // Add starting zero points for all diagrams
    combined.push({
      x: 0,
      shear: 0,
      moment: 0,
      axial: 0,
      spanIndex: 0
    });

    
    
    allDiagramData.forEach(({ data }, spanIndex) => {
      // Find the length of this span from its data
      const spanLength = data.length > 0 ? data[data.length - 1].x : 0;
      
      // Add data points for this span
      data.forEach((p) => {
        combined.push({
          x: p.x + currentXOffset,
          shear: p.shear,
          moment: p.moment,
          axial: p.axial,
          spanIndex: spanIndex + 1
        });
      });
      
      // Update offset for next span
      currentXOffset += spanLength;
    });

    // Add ending zero points for all diagrams
    if (combined.length > 1) {
      const lastX = combined[combined.length - 1].x;
      combined.push({
        x: lastX,
        shear: 0,
        moment: 0,
        axial: 0,
        spanIndex: allDiagramData.length + 1
      });
    }
    
    return combined;
  }, [allDiagramData]);

 
console.log("COMBINED DATA: ", combinedData)
  return (
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Bending Moment Diagram (BMD) */}
      <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-[#d4d4d8]">Bending Moment Diagram (BMD)</h3>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#3b82f6]">Overall Span</div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={combinedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis 
                dataKey="x" 
                stroke="#666" 
                tick={{fill: '#666', fontSize: 10}}
                tickFormatter={(val) => `${val.toFixed(1)}m`}
                type="number"
                domain={[0, 'auto']}
              />
              <YAxis 
                stroke="#3b82f6" 
                tick={{fill: '#3b82f6', fontSize: 10}}
                label={{ value: 'Moment (kNm)', angle: -90, position: 'insideLeft', style: { fill: '#3b82f6', fontSize: 11 } }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#000', borderColor: '#333', borderRadius: '8px', fontSize: '10px' }}
                formatter={(value: any) => Number(value).toFixed(2)}
                labelFormatter={(label) => `Position: ${Number(label).toFixed(2)}m`}
              />
              <ReferenceLine y={0} stroke="#444" strokeDasharray="3 3" />
              
              <Area
                type="linear"
                dataKey="moment"
                stroke="#3b82f6"
                fill="rgba(59, 130, 246, 0.2)"
                strokeWidth={2}
                fillOpacity={0.6}
                name="Bending Moment"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Shear Force Diagram (SFD) */}
      <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-[#d4d4d8]">Shear Force Diagram (SFD)</h3>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#10b981]">Overall Span</div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={combinedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis 
                dataKey="x" 
                stroke="#666" 
                tick={{fill: '#666', fontSize: 10}}
                tickFormatter={(val) => `${val.toFixed(1)}m`}
                type="number"
                domain={[0, 'auto']}
              />
              <YAxis 
                stroke="#10b981" 
                tick={{fill: '#10b981', fontSize: 10}}
                label={{ value: 'Shear (kN)', angle: -90, position: 'insideLeft', style: { fill: '#10b981', fontSize: 11 } }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#000', borderColor: '#333', borderRadius: '8px', fontSize: '10px' }}
                formatter={(value: any) => Number(value).toFixed(2)}
                labelFormatter={(label) => `Position: ${Number(label).toFixed(2)}m`}
              />
              <ReferenceLine y={0} stroke="#444" strokeDasharray="3 3" />
              
              <Area
                type="linear"
                dataKey="shear"
                stroke="#10b981"
                fill="rgba(16, 185, 129, 0.2)"
                strokeWidth={2}
                fillOpacity={0.6}
                name="Shear Force"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Axial Force Diagram (AFD) */}
      <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-[#d4d4d8]">Axial Force Diagram (AFD)</h3>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#f43f5e]">Overall Span</div>
        </div>

        {/* <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={combinedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis 
                dataKey="x" 
                stroke="#666" 
                tick={{fill: '#666', fontSize: 10}}
                tickFormatter={(val) => `${val.toFixed(1)}m`}
              />
              <YAxis 
                stroke="#f43f5e" 
                tick={{fill: '#f43f5e', fontSize: 10}}
                label={{ value: 'Axial (kN)', angle: -90, position: 'insideLeft', style: { fill: '#f43f5e', fontSize: 11 } }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#000', borderColor: '#333', borderRadius: '8px', fontSize: '10px' }}
                formatter={(value: any) => Number(value).toFixed(2)}
                labelFormatter={(label) => `Position: ${Number(label).toFixed(2)}m`}
              />
              <ReferenceLine y={0} stroke="#444" strokeDasharray="3 3" />
              
              <Area
                type="linear"
                dataKey="axial"
                stroke="#f43f5e"
                fill="rgba(244, 63, 94, 0.2)"
                strokeWidth={2}
                fillOpacity={0.6}
                name="Axial Force"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div> */}
      </div>
    </div>
  );
}

 
