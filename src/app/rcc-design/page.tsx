"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RCCDesignFormulaes } from "@_lib/RCCDesign/RCCDesignFormulaes";
import { designShortBracedColumn } from "@_lib/RCCDesign/columnDesign";

type BeamType = "Rectangular" | "L" | "T";

export default function RCCDesignPage() {
  const [fcu, setFcu] = useState(30);
  const [fy, setFy] = useState(460);

  const [beamType, setBeamType] = useState<BeamType>("Rectangular");
  const [b, setB] = useState(250);
  const [h, setH] = useState(500);
  const [cover, setCover] = useState(25);
  const [linkDia, setLinkDia] = useState(10);
  const [mainBarDia, setMainBarDia] = useState(16);
  const [designMoment, setDesignMoment] = useState(120);
  const [continuousSpanMm, setContinuousSpanMm] = useState(5000);

  const [columnLoad, setColumnLoad] = useState(1200);
  const [columnWidth, setColumnWidth] = useState(225);
  const [columnDepth, setColumnDepth] = useState(225);
  const [columnClearHeight, setColumnClearHeight] = useState(3000);

  const beamDesign = useMemo(() => {
    try {
      const rcc = new RCCDesignFormulaes(fcu, fy);
      const d = rcc.calculateEffectiveDepth(h, cover, linkDia, mainBarDia);
      const momentKNm = Math.max(0, designMoment);

      let K = 0;
      let bf = b;
      if (beamType === "L" || beamType === "T") {
        const flanged = rcc.calculateKForFlangedBeam(
          momentKNm,
          beamType,
          b,
          continuousSpanMm,
          d,
        );
        K = flanged.K;
        bf = flanged.bf;
      } else {
        K = rcc.calculateK(momentKNm, b, d);
      }

      if (K >= 0.225) {
        return {
          ok: false as const,
          message:
            "Section is beyond singly-reinforced range for this simplified workflow. Increase section or use doubly-reinforced design.",
        };
      }

      const z = rcc.calculateLeverArm(K, d);
      const x = rcc.calculateNeutralAxisDepth(z, d);
      const As = rcc.calculateSteelAreaBS8110(momentKNm, z);
      const AsMin = rcc.calculateAsMin(b, h);
      const AsMax = rcc.calculateAsMax(b, h);

      return {
        ok: true as const,
        d,
        K,
        z,
        x,
        As,
        AsMin,
        AsMax,
        bf,
      };
    } catch (error: any) {
      return {
        ok: false as const,
        message: error?.message || "Beam design calculation failed.",
      };
    }
  }, [
    b,
    beamType,
    continuousSpanMm,
    cover,
    designMoment,
    fcu,
    fy,
    h,
    linkDia,
    mainBarDia,
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
            <LabeledNumber label="fcu (N/mm²)" value={fcu} onChange={setFcu} />
            <LabeledNumber label="fy (N/mm²)" value={fy} onChange={setFy} />
            <LabeledSelect
              label="Beam Type"
              value={beamType}
              onChange={(v) => setBeamType(v as BeamType)}
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
              label="Design Moment (kNm)"
              value={designMoment}
              onChange={setDesignMoment}
            />
            {(beamType === "L" || beamType === "T") && (
              <LabeledNumber
                label="Continuous Span (mm)"
                value={continuousSpanMm}
                onChange={setContinuousSpanMm}
              />
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs">
            {!beamDesign.ok && (
              <p className="font-bold text-amber-300">{beamDesign.message}</p>
            )}
            {beamDesign.ok && (
              <div className="grid grid-cols-2 gap-y-2">
                <Stat label="Effective depth d" value={`${beamDesign.d.toFixed(2)} mm`} />
                <Stat label="K factor" value={beamDesign.K.toFixed(4)} />
                <Stat label="Lever arm z" value={`${beamDesign.z.toFixed(2)} mm`} />
                <Stat label="Neutral axis x" value={`${beamDesign.x.toFixed(2)} mm`} />
                <Stat label="Required As" value={`${beamDesign.As.toFixed(2)} mm²`} />
                <Stat label="As,min" value={`${beamDesign.AsMin.toFixed(2)} mm²`} />
                <Stat label="As,max" value={`${beamDesign.AsMax.toFixed(2)} mm²`} />
                <Stat label="Effective bf" value={`${beamDesign.bf.toFixed(2)} mm`} />
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
            <LabeledNumber label="fcu (N/mm²)" value={fcu} onChange={setFcu} />
            <LabeledNumber label="fy (N/mm²)" value={fy} onChange={setFy} />
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs">
            <p
              className={`font-black uppercase tracking-widest ${
                columnDesign.status === "SUCCESS" ? "text-emerald-300" : "text-amber-300"
              }`}
            >
              {columnDesign.status}
            </p>
            <p className="mt-1 text-gray-300">{columnDesign.message}</p>
            {columnDesign.status === "SUCCESS" && (
              <div className="mt-3 grid grid-cols-2 gap-y-2">
                <Stat
                  label="Required Asc"
                  value={`${columnDesign.steelRequiredArea ?? 0} mm²`}
                />
                <Stat
                  label="Provided Steel"
                  value={columnDesign.providedSteel ?? "-"}
                />
                <Stat
                  label="Provided Area"
                  value={`${columnDesign.providedArea ?? 0} mm²`}
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
