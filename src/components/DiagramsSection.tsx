"use client";

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ForceUnit,
  LengthUnit,
  MomentUnit,
  convertForce,
  convertLength,
  convertMoment,
} from "@/utils/unitUtils";

type ResultUnitPreference = {
  force: ForceUnit;
  length: LengthUnit;
  moment: MomentUnit;
};

type DiagramPoint = {
  x: number;
  shear: number;
  moment: number;
  axial: number;
};

interface DiagramsSectionProps {
  beamDiagrams: { span: string; data: DiagramPoint[] }[];
  resultUnits: ResultUnitPreference;
}

export default function DiagramsSection({
  beamDiagrams,
  resultUnits,
}: DiagramsSectionProps) {
  const combinedData = useMemo(() => {
    const combined: {
      x: number;
      shear: number;
      moment: number;
      axial: number;
      spanIndex: number;
    }[] = [];

    let xOffset = 0;
    beamDiagrams.forEach((span, spanIndex) => {
      if (!span.data.length) return;
      span.data.forEach((point) => {
        combined.push({
          x: point.x + xOffset,
          shear: point.shear,
          moment: point.moment,
          axial: point.axial,
          spanIndex: spanIndex + 1,
        });
      });
      xOffset += span.data[span.data.length - 1].x;
    });

    return combined;
  }, [beamDiagrams]);

  if (!beamDiagrams.length) return null;

  const displayLength = (value: number) =>
    convertLength(value, "m", resultUnits.length);
  const displayMoment = (value: number) =>
    convertMoment(value, "kN*m", resultUnits.moment);
  const displayForce = (value: number) =>
    convertForce(value, "kN", resultUnits.force);

  return (
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-[#d4d4d8]">
            Bending Moment Diagram (BMD) - {resultUnits.moment}
          </h3>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#3b82f6]">
            Solver Native
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={combinedData}
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis
                dataKey="x"
                stroke="#666"
                tick={{ fill: "#666", fontSize: 10 }}
                tickFormatter={(val) =>
                  `${displayLength(Number(val)).toFixed(2)}${resultUnits.length}`
                }
                type="number"
                domain={[0, "auto"]}
              />
              <YAxis
                stroke="#3b82f6"
                tick={{ fill: "#3b82f6", fontSize: 10 }}
                label={{
                  value: `Moment (${resultUnits.moment})`,
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "#3b82f6", fontSize: 11 },
                }}
                tickFormatter={(val) => displayMoment(Number(val)).toFixed(2)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#000",
                  borderColor: "#333",
                  borderRadius: "8px",
                  fontSize: "10px",
                }}
                formatter={(value: any) =>
                  `${displayMoment(Number(value)).toFixed(2)} ${resultUnits.moment}`
                }
                labelFormatter={(label) =>
                  `Position: ${displayLength(Number(label)).toFixed(2)} ${resultUnits.length}`
                }
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

      <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-[#d4d4d8]">
            Shear Force Diagram (SFD) - {resultUnits.force}
          </h3>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#10b981]">
            Upward +ve
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={combinedData}
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis
                dataKey="x"
                stroke="#666"
                tick={{ fill: "#666", fontSize: 10 }}
                tickFormatter={(val) =>
                  `${displayLength(Number(val)).toFixed(2)}${resultUnits.length}`
                }
                type="number"
                domain={[0, "auto"]}
              />
              <YAxis
                stroke="#10b981"
                tick={{ fill: "#10b981", fontSize: 10 }}
                label={{
                  value: `Shear (${resultUnits.force})`,
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "#10b981", fontSize: 11 },
                }}
                tickFormatter={(val) => displayForce(Number(val)).toFixed(2)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#000",
                  borderColor: "#333",
                  borderRadius: "8px",
                  fontSize: "10px",
                }}
                formatter={(value: any) =>
                  `${displayForce(Number(value)).toFixed(2)} ${resultUnits.force}`
                }
                labelFormatter={(label) =>
                  `Position: ${displayLength(Number(label)).toFixed(2)} ${resultUnits.length}`
                }
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
    </div>
  );
}
