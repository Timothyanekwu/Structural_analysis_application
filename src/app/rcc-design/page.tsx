"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RCCDesignFormulaes } from "@_lib/RCCDesign/RCCDesignFormulaes";
import type {
  FlexuralZoneDesignResult,
  SpanSectionType,
} from "@_lib/RCCDesign/RCCDesignFormulaes";
import { designShortBracedColumn } from "@_lib/RCCDesign/columnDesign";

export default function RCCDesignPage() {
  const [fcu, setFcu] = useState(30);
  const [fy, setFy] = useState(460);

  const [spanSectionType, setSpanSectionType] =
    useState<SpanSectionType>("T");
  const [b, setB] = useState(250);
  const [h, setH] = useState(500);
  const [cover, setCover] = useState(25);
  const [linkDia, setLinkDia] = useState(10);
  const [mainBarDia, setMainBarDia] = useState(16);
  const [supportMoment, setSupportMoment] = useState(120);
  const [spanMoment, setSpanMoment] = useState(120);
  const [continuousSpanMm, setContinuousSpanMm] = useState(5000);

  const [columnLoad, setColumnLoad] = useState(1200);
  const [columnWidth, setColumnWidth] = useState(225);
  const [columnDepth, setColumnDepth] = useState(225);
  const [columnClearHeight, setColumnClearHeight] = useState(3000);

  const beamDesign = useMemo(() => {
    try {
      const rcc = new RCCDesignFormulaes(fcu, fy);
      const result = rcc.designBeamByZones({
        supportMoment,
        spanMoment,
        spanSectionType,
        beamWidth: b,
        overallDepth: h,
        concreteCover: cover,
        linkDiameter: linkDia,
        mainBarDiameter: mainBarDia,
        continuousSpanLength:
          spanSectionType === "L" || spanSectionType === "T"
            ? continuousSpanMm
            : undefined,
      });

      return {
        result,
        error: null as string | null,
      };
    } catch (error: any) {
      return {
        result: null,
        error: error?.message || "Beam design calculation failed.",
      };
    }
  }, [
    b,
    continuousSpanMm,
    cover,
    fcu,
    fy,
    h,
    linkDia,
    mainBarDia,
    spanMoment,
    spanSectionType,
    supportMoment,
  ]);

  const columnDesign = useMemo(() => {
    try {
      return designShortBracedColumn({
        load_kN: columnLoad,
        width_mm: columnWidth,
        depth_mm: columnDepth,
        clearHeight_mm: columnClearHeight,
        fcu,
        fy,
      });
    } catch (error: any) {
      return {
        status: "TERMINATED" as const,
        message: error?.message || "Column design calculation failed.",
      };
    }
  }, [columnClearHeight, columnDepth, columnLoad, columnWidth, fcu, fy]);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="sticky top-0 z-10 border-b border-white/5 glassy-panel">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">
              Structuro System
            </p>
            <h1 className="text-2xl font-black uppercase tracking-tight">
              RCC Design Workspace
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/analysis?type=beams"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:bg-white/10"
            >
              Beam Analysis
            </Link>
            <Link
              href="/analysis?type=frames"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:bg-white/10"
            >
              Frame Analysis
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-gray-300">
            Beam Flexural Design (BS 8110)
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <LabeledNumber label="fcu (N/mm^2)" value={fcu} onChange={setFcu} />
            <LabeledNumber label="fy (N/mm^2)" value={fy} onChange={setFy} />
            <LabeledSelect
              label="Span Section Type"
              value={spanSectionType}
              onChange={(v) => setSpanSectionType(v as SpanSectionType)}
              options={["Rectangular", "L", "T"]}
            />
            <LabeledNumber label="bw (mm)" value={b} onChange={setB} />
            <LabeledNumber label="h (mm)" value={h} onChange={setH} />
            <LabeledNumber label="Cover (mm)" value={cover} onChange={setCover} />
            <LabeledNumber
              label="Link Dia (mm)"
              value={linkDia}
              onChange={setLinkDia}
            />
            <LabeledNumber
              label="Main Bar Dia (mm)"
              value={mainBarDia}
              onChange={setMainBarDia}
            />
            <LabeledNumber
              label="Support Moment |Mu-| (kNm)"
              value={supportMoment}
              onChange={setSupportMoment}
            />
            <LabeledNumber
              label="Span Moment |Mu+| (kNm)"
              value={spanMoment}
              onChange={setSpanMoment}
            />
            {(spanSectionType === "L" || spanSectionType === "T") && (
              <LabeledNumber
                label="Continuous Span (mm)"
                value={continuousSpanMm}
                onChange={setContinuousSpanMm}
              />
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs">
            {beamDesign.error && (
              <p className="font-bold text-amber-300">{beamDesign.error}</p>
            )}

            {beamDesign.result && (
              <div className="space-y-4">
                {!beamDesign.result.ok && beamDesign.result.messages.length > 0 && (
                  <div className="space-y-1">
                    {beamDesign.result.messages.map((message, idx) => (
                      <p key={idx} className="font-bold text-amber-300">
                        {message}
                      </p>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-y-2">
                  <Stat
                    label="Effective depth d"
                    value={`${beamDesign.result.d.toFixed(2)} mm`}
                  />
                  <Stat
                    label="As,min"
                    value={`${beamDesign.result.AsMin.toFixed(2)} mm^2`}
                  />
                  <Stat
                    label="As,max"
                    value={`${beamDesign.result.AsMax.toFixed(2)} mm^2`}
                  />
                  <Stat
                    label="Top steel (support)"
                    value={formatNullable(beamDesign.result.topSteelRequired, "mm^2")}
                  />
                  <Stat
                    label="Bottom steel (span)"
                    value={formatNullable(
                      beamDesign.result.bottomSteelRequired,
                      "mm^2",
                    )}
                  />
                  <Stat
                    label="Governing steel"
                    value={formatNullable(
                      beamDesign.result.governingSteelRequired,
                      "mm^2",
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <ZoneCard
                    title="Support Zone (Rectangular)"
                    zone={beamDesign.result.support}
                  />
                  <ZoneCard
                    title={`Span Zone (${beamDesign.result.span.sectionType})`}
                    zone={beamDesign.result.span}
                  />
                </div>

                <p className="text-[10px] text-gray-500">
                  Support zone is always designed as rectangular. Span zone uses
                  the selected section type.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-gray-300">
            Short Braced Column Design (BS 8110)
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <LabeledNumber
              label="Design Load (kN)"
              value={columnLoad}
              onChange={setColumnLoad}
            />
            <LabeledNumber
              label="Width b (mm)"
              value={columnWidth}
              onChange={setColumnWidth}
            />
            <LabeledNumber
              label="Depth h (mm)"
              value={columnDepth}
              onChange={setColumnDepth}
            />
            <LabeledNumber
              label="Clear Height (mm)"
              value={columnClearHeight}
              onChange={setColumnClearHeight}
            />
            <LabeledNumber label="fcu (N/mm^2)" value={fcu} onChange={setFcu} />
            <LabeledNumber label="fy (N/mm^2)" value={fy} onChange={setFy} />
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs">
            <p
              className={`font-black uppercase tracking-widest ${
                columnDesign.status === "SUCCESS"
                  ? "text-emerald-300"
                  : "text-amber-300"
              }`}
            >
              {columnDesign.status}
            </p>
            <p className="mt-1 text-gray-300">{columnDesign.message}</p>
            {columnDesign.status === "SUCCESS" && (
              <div className="mt-3 grid grid-cols-2 gap-y-2">
                <Stat
                  label="Required Asc"
                  value={`${columnDesign.steelRequiredArea ?? 0} mm^2`}
                />
                <Stat
                  label="Provided Steel"
                  value={columnDesign.providedSteel ?? "-"}
                />
                <Stat
                  label="Provided Area"
                  value={`${columnDesign.providedArea ?? 0} mm^2`}
                />
                <Stat label="Links" value={columnDesign.links ?? "-"} />
                <Stat
                  label="Utilization"
                  value={`${((columnDesign.utilizationRatio ?? 0) * 100).toFixed(0)}%`}
                />
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function LabeledNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">
        {label}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-xs font-bold outline-none"
      />
    </label>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-xs font-bold outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-gray-500">{label}</span>
      <span className="font-bold text-gray-200">{value}</span>
    </>
  );
}

function formatNullable(
  value: number | null,
  unit: string,
  digits = 2,
): string {
  if (value === null) return "-";
  return `${value.toFixed(digits)} ${unit}`;
}

function ZoneCard({
  title,
  zone,
}: {
  title: string;
  zone: FlexuralZoneDesignResult;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          {title}
        </p>
        <span
          className={`text-[10px] font-black uppercase tracking-widest ${
            zone.ok ? "text-emerald-300" : "text-amber-300"
          }`}
        >
          {zone.ok ? "OK" : "CHECK"}
        </span>
      </div>

      {!zone.ok && zone.message && (
        <p className="mb-2 text-[10px] font-bold text-amber-300">{zone.message}</p>
      )}

      <div className="grid grid-cols-2 gap-y-1 text-[11px]">
        <Stat label="|Mu|" value={`${zone.designMoment.toFixed(2)} kNm`} />
        <Stat label="Section width used" value={`${zone.sectionWidthUsed.toFixed(2)} mm`} />
        <Stat label="bf" value={formatNullable(zone.bf, "mm")} />
        <Stat label="K" value={zone.K === null ? "-" : zone.K.toFixed(4)} />
        <Stat label="z" value={formatNullable(zone.z, "mm")} />
        <Stat label="x" value={formatNullable(zone.x, "mm")} />
        <Stat label="As required" value={formatNullable(zone.As, "mm^2")} />
      </div>
    </div>
  );
}
