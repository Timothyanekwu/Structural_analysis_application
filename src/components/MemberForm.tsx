"use client";

import { useState, useEffect } from "react";
import StructurePreview, { Member, Load } from "./StructurePreview";
import UnitInput from "./UnitInput";
import {
  ElasticModulusUnit,
  ForceUnit,
  InertiaUnit,
  LengthUnit,
  LoadingUnit,
  MomentUnit,
} from "@/utils/unitUtils";

type Point = { x: number | ""; y: number | "" };
// Simplified for Beam context - internally always "Beam"
type SupportType = "None" | "Fixed" | "Pinned" | "Roller";
type LoadType = "Point" | "UDL" | "VDL";

interface MemberFormProps {
  mode?: "beams" | "frames";
  onSuccess?: (data: any) => void;
  initialStartNode?: { x: number; y: number };
  existingNodes?: { x: number; y: number }[];
  nodeSupports?: Record<string, { type: string; settlement?: number } | string>;
  initialData?: Member;
  defaultUnits?: {
    length: LengthUnit;
    force: ForceUnit;
    loading: LoadingUnit;
    moment: MomentUnit;
    elasticModulus: ElasticModulusUnit;
    inertia: InertiaUnit;
  };
}

export default function MemberForm({
  mode = "beams",
  onSuccess,
  initialStartNode,
  existingNodes = [],
  nodeSupports = {},
  initialData,
  defaultUnits = {
    length: "m",
    force: "kN",
    loading: "kN/m",
    moment: "kN*m",
    elasticModulus: "GPa",
    inertia: "m^4",
  },
}: MemberFormProps) {
  const isBeamMode = mode === "beams";

  // Logic for finding initial selected node index
  const findNodeIndex = (p?: { x: number; y: number }) => {
    if (!p) return -1;
    return existingNodes.findIndex((n) => n.x === p.x && n.y === p.y);
  };

  const [memberType, setMemberType] = useState<"Beam" | "Column" | "Inclined">(
    isBeamMode ? "Beam" : (initialData?.memberType as any) || "Beam",
  );

  const [startNodeIdx, setStartNodeIdx] = useState<number>(
    findNodeIndex(initialData?.startNode || initialStartNode),
  );
  const [endNodeIdx, setEndNodeIdx] = useState<number>(
    findNodeIndex(initialData?.endNode),
  );

  const [startNode, setStartNode] = useState<Point>(
    initialData?.startNode
      ? { x: initialData.startNode.x, y: initialData.startNode.y }
      : initialStartNode
        ? { x: initialStartNode.x, y: initialStartNode.y }
        : { x: "", y: "" },
  );
  const [endNode, setEndNode] = useState<Point>(
    initialData?.endNode
      ? { x: initialData.endNode.x, y: initialData.endNode.y }
      : { x: "", y: "" },
  );

  const [supports, setSupports] = useState<{
    start: SupportType;
    end: SupportType;
  }>(initialData?.supports || { start: "None", end: "None" });
  const [settlement, setSettlement] = useState<{
    start: number | "";
    end: number | "";
  }>({
    start: initialData?.supports?.startSettlement || "",
    end: initialData?.supports?.endSettlement || "",
  });

  const [sectionProps, setSectionProps] = useState<{
    b: number | "";
    h: number | "";
    slabThickness: number | "";
  }>({
    b: initialData?.b ?? "",
    h: initialData?.h ?? "",
    slabThickness: initialData?.slabThickness ?? "",
  });

  const [loads, setLoads] = useState<Load[]>(initialData?.loads || []);
  const [newLoad, setNewLoad] = useState<{
    type: LoadType;
    value: number | "";
    position: number | "";
    span: number | "";
    angle: number | "";
    lowPosition: number | "";
    highPosition: number | "";
  }>({
    type: "Point",
    value: "",
    position: "",
    span: "",
    angle: 90,
    lowPosition: "",
    highPosition: "",
  });

  const DEFAULT_E_MODULUS = 25000000; // 25 GPa in base kN/m^2
  const [Ecoef, setEcoef] = useState<number | "">(
    initialData?.Ecoef && initialData.Ecoef !== 1
      ? initialData.Ecoef
      : DEFAULT_E_MODULUS,
  );
  const [Icoef, setIcoef] = useState<number | "">(
    initialData?.Icoef && initialData.Icoef !== 1 ? initialData.Icoef : "",
  );
  const [isEConstant, setIsEConstant] = useState<boolean>(
    initialData?.Ecoef === 1,
  );
  const [isIConstant, setIsIConstant] = useState<boolean>(
    initialData?.Icoef === 1,
  );
  const [isDesignMode, setIsDesignMode] = useState<boolean>(
    (initialData?.b ?? 0) > 0 ||
      (initialData?.h ?? 0) > 0 ||
      (initialData?.slabThickness ?? 0) > 0,
  );
  const [useSettlements, setUseSettlements] = useState<boolean>(
    (initialData?.supports?.startSettlement ?? 0) !== 0 ||
      (initialData?.supports?.endSettlement ?? 0) !== 0,
  );
  const [unitResetSignal, setUnitResetSignal] = useState(0);

  const [focusNode, setFocusNode] = useState<"start" | "end" | null>(null);

  // Smart Alignment Enforcement
  useEffect(() => {
    if (memberType === "Beam") {
      // Horizontal Lock: Y coordinates must match
      if (startNode.y !== endNode.y && startNode.y !== "" && endNode.y !== "") {
        // If we just changed start, update end. Otherwise update start.
        if (focusNode === "start")
          setEndNode((prev) => ({ ...prev, y: startNode.y }));
        else if (focusNode === "end")
          setStartNode((prev) => ({ ...prev, y: endNode.y }));
      }
    } else if (memberType === "Column") {
      // Vertical Lock: X coordinates must match
      if (startNode.x !== endNode.x && startNode.x !== "" && endNode.x !== "") {
        if (focusNode === "start")
          setEndNode((prev) => ({ ...prev, x: startNode.x }));
        else if (focusNode === "end")
          setStartNode((prev) => ({ ...prev, x: endNode.x }));
      }
    }
  }, [memberType, startNode.x, startNode.y, endNode.x, endNode.y, focusNode]);

  // Update local state when dropdown changes
  useEffect(() => {
    if (startNodeIdx !== -1) {
      const n = existingNodes[startNodeIdx];
      setStartNode({ x: n.x, y: n.y });

      // Auto-propagate based on member type
      if (memberType === "Column") {
        setEndNode((prev) => ({ ...prev, x: n.x }));
      } else if (memberType === "Beam") {
        setEndNode((prev) => ({ ...prev, y: n.y }));
      }

      const sData = nodeSupports[JSON.stringify(n)];
      if (sData) {
        if (typeof sData === "string") {
          setSupports((prev) => ({ ...prev, start: sData as SupportType }));
          setSettlement((prev) => ({ ...prev, start: "" }));
        } else {
          setSupports((prev) => ({
            ...prev,
            start: sData.type as SupportType,
          }));
          setSettlement((prev) => ({ ...prev, start: sData.settlement ?? "" }));
        }
      }
    }
  }, [startNodeIdx, existingNodes, nodeSupports, memberType]);

  useEffect(() => {
    if (endNodeIdx !== -1) {
      const n = existingNodes[endNodeIdx];
      setEndNode({ x: n.x, y: n.y });

      // Auto-propagate based on member type
      if (memberType === "Column") {
        setStartNode((prev) => ({ ...prev, x: n.x }));
      } else if (memberType === "Beam") {
        setStartNode((prev) => ({ ...prev, y: n.y }));
      }

      const sData = nodeSupports[JSON.stringify(n)];
      if (sData) {
        if (typeof sData === "string") {
          setSupports((prev) => ({ ...prev, end: sData as SupportType }));
          setSettlement((prev) => ({ ...prev, end: "" }));
        } else {
          setSupports((prev) => ({ ...prev, end: sData.type as SupportType }));
          setSettlement((prev) => ({ ...prev, end: sData.settlement ?? "" }));
        }
      }
    }
  }, [endNodeIdx, existingNodes, nodeSupports, memberType]);

  const addLoad = () => {
    if (newLoad.value === "") return;
    setLoads([
      ...loads,
      {
        id: Math.random().toString(36).substr(2, 9),
        type: newLoad.type,
        value: Number(newLoad.value),
        position:
          newLoad.type === "VDL"
            ? Number(newLoad.highPosition || 0)
            : Number(newLoad.position || 0),
        span: newLoad.type === "UDL" ? Number(newLoad.span || 0) : undefined,
        angle: Number(newLoad.angle || 90),
        // VDL specific
        highValue: newLoad.type === "VDL" ? Number(newLoad.value) : undefined,
        highPosition:
          newLoad.type === "VDL"
            ? Number(newLoad.highPosition || 0)
            : undefined,
        lowPosition:
          newLoad.type === "VDL" ? Number(newLoad.lowPosition || 0) : undefined,
      },
    ]);
    setNewLoad({
      type: "Point",
      value: "",
      position: "",
      span: "",
      angle: 90,
      lowPosition: "",
      highPosition: "",
    });
  };

  const createMember = () => {
    const resolvedE = isEConstant
      ? 1
      : Ecoef === ""
        ? DEFAULT_E_MODULUS
        : Number(Ecoef);
    const resolvedI = isIConstant ? 1 : Icoef === "" ? undefined : Number(Icoef);
    if (!isDesignMode && !isIConstant && (Icoef === "" || Icoef === undefined)) {
      alert(
        "Please provide I for Analysis mode, or enable 'I Constant x1', or switch to Design mode.",
      );
      return;
    }
    const resolvedSectionProps = isDesignMode
      ? {
          b: Number(sectionProps.b || 0),
          h: Number(sectionProps.h || 0),
          slabThickness: Number(sectionProps.slabThickness || 0),
        }
      : { b: 0, h: 0, slabThickness: 0 };
    const resolvedSettlements = useSettlements
      ? {
          startSettlement: Number(settlement.start || 0),
          endSettlement: Number(settlement.end || 0),
        }
      : { startSettlement: 0, endSettlement: 0 };
    const memberData = {
      startNode: {
        x: Number(startNode.x || 0),
        y: isBeamMode ? 0 : Number(startNode.y || 0),
      },
      endNode: {
        x: Number(endNode.x || 0),
        y: isBeamMode ? 0 : Number(endNode.y || 0),
      },
      memberType: isBeamMode ? "Beam" : memberType,
      workflowMode: isDesignMode ? "design" : "analysis",
      includeSettlements: useSettlements,
      supports: {
        ...supports,
        ...resolvedSettlements,
      },
      loads,
      Ecoef: resolvedE,
      Icoef: resolvedI,
      ...resolvedSectionProps,
    };
    if (onSuccess) onSuccess(memberData);
  };

  const currentPreviewMember: Member = {
    // Keep preview and submission data aligned.
    // If I is omitted, solver will derive it from section properties.
    startNode: {
      x: Number(startNode.x || 0),
      y: isBeamMode ? 0 : Number(startNode.y || 0),
    },
    endNode: {
      x: Number(endNode.x || 0),
      y: isBeamMode ? 0 : Number(endNode.y || 0),
    },
    memberType: isBeamMode ? "Beam" : memberType,
    workflowMode: isDesignMode ? "design" : "analysis",
    includeSettlements: useSettlements,
    supports: {
      ...supports,
      startSettlement: useSettlements ? Number(settlement.start || 0) : 0,
      endSettlement: useSettlements ? Number(settlement.end || 0) : 0,
    },
    loads: loads,
    Ecoef: isEConstant
      ? 1
      : Ecoef === ""
        ? DEFAULT_E_MODULUS
        : Number(Ecoef),
    Icoef: isIConstant ? 1 : Icoef === "" ? undefined : Number(Icoef),
    b: isDesignMode ? Number(sectionProps.b || 0) : 0,
    h: isDesignMode ? Number(sectionProps.h || 0) : 0,
    slabThickness: isDesignMode ? Number(sectionProps.slabThickness || 0) : 0,
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-0 w-full min-h-[70vh] bg-[#050505] text-white overflow-hidden">
      {/* Visual Feedback (Left 3/5) */}
      <div className="xl:col-span-7 bg-black/40 p-4 sm:p-6 flex flex-col relative border-b xl:border-b-0 xl:border-r border-white/5 min-h-[300px]">
        <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse shadow-[0_0_8px_var(--primary-glow)]"></div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
            Geometry Kernel Preview
          </span>
        </div>
        <div className="flex-1 rounded-3xl overflow-hidden border border-white/5 bg-black/20 shadow-inner">
          <StructurePreview
            members={[currentPreviewMember]}
            highlightNode={
              focusNode === "start"
                ? { x: Number(startNode.x || 0), y: Number(startNode.y || 0) }
                : focusNode === "end"
                  ? { x: Number(endNode.x || 0), y: Number(endNode.y || 0) }
                  : null
            }
          />
        </div>
        <div className="mt-4 flex justify-between items-center text-[9px] uppercase font-bold text-gray-600 tracking-widest">
          <span>Precision: 64-bit float</span>
          <span>
            State: {initialData ? "RE-EDITING" : "INITIAL_DEFINITION"}
          </span>
        </div>
      </div>

      {/* Controller (Right 2/5) */}
      <div className="xl:col-span-5 p-5 sm:p-6 lg:p-7 xl:p-8 space-y-8 overflow-y-auto xl:max-h-[85vh] custom-scrollbar">
        <header>
          <h2 className="text-3xl font-black tracking-tighter gradient-text uppercase mb-1">
            {initialData ? "Sync Config" : "Init Matrix"}
          </h2>
          <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">
            {isBeamMode ? "Beam" : "Member"} Definition Protocol
          </p>
          <button
            type="button"
            onClick={() => setUnitResetSignal((prev) => prev + 1)}
            className="mt-3 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400 transition-colors hover:text-white"
          >
            Reset Unit Selectors To App Defaults
          </button>
        </header>

        {/* SECTION 00: MEMBER TYPE - Only for Frames */}
        {!isBeamMode && (
          <section className="space-y-5">
            <header className="flex items-center gap-4">
              <span className="text-[10px] font-black text-white bg-white/10 px-2 py-0.5 rounded">
                00
              </span>
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
                Member Type
              </h3>
              <div className="flex-1 h-px bg-white/5"></div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {["Beam", "Column", "Inclined"].map((type) => (
                <button
                  key={type}
                  onClick={() => setMemberType(type as any)}
                  className={`flex-1 py-3 rounded-xl border text-[10px] font-black uppercase transition-all duration-300 ${
                    memberType === type
                      ? "bg-[var(--primary)] border-[var(--primary)] text-white shadow-lg shadow-[0_0_20px_rgba(18,164,76,0.1)]"
                      : "bg-white/[0.02] border-white/5 text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* GEOMETRY KERNEL */}
        <section className="space-y-5">
          <header className="flex items-center gap-4">
            <span className="text-[10px] font-black text-[var(--primary)] bg-[var(--primary-glow)] px-2 py-0.5 rounded">
              01
            </span>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
              Spatial Coordinates
            </h3>
            <div className="flex-1 h-px bg-white/5"></div>
          </header>

          <div className="space-y-5">
            {/* Start Node */}
            <div
              onFocus={() => setFocusNode("start")}
              className={`group bg-white/[0.02] border p-4 rounded-2xl transition-all hover:bg-white/[0.04] ${focusNode === "start" ? "border-[var(--primary)] shadow-[0_0_20px_rgba(18,164,76,0.1)]" : "border-white/5"}`}
            >
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label
                  className={`text-[10px] font-black uppercase tracking-widest transition-colors ${focusNode === "start" ? "text-[var(--primary)]" : "text-gray-500"}`}
                >
                  Start Node
                </label>
                <select
                  value={startNodeIdx}
                  onFocus={() => setFocusNode("start")}
                  onChange={(e) => setStartNodeIdx(Number(e.target.value))}
                  className="w-full sm:w-auto bg-black border border-white/10 rounded-lg text-[9px] font-bold px-2 py-1 uppercase tracking-tighter text-[var(--primary)] outline-none"
                >
                  <option value={-1}>Explicit Entry</option>
                  {existingNodes.map((n, i) => (
                    <option key={i} value={i}>
                      {isBeamMode
                        ? `Anchor N${i + 1} (${n.x}m)`
                        : `N${i + 1} (${n.x}, ${n.y})m`}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className={`grid grid-cols-1 ${!isBeamMode ? "sm:grid-cols-2" : ""} gap-4`}
              >
                <div className="relative">
                  <UnitInput
                    unitType="length"
                    preferredUnit={defaultUnits.length}
                    resetSignal={unitResetSignal}
                    disabled={
                      startNodeIdx !== -1 ||
                      (!isBeamMode && memberType === "Column")
                    }
                    value={startNode.x}
                    onChange={(val) => {
                      setFocusNode("start");
                      setStartNode({
                        ...startNode,
                        x: val === "" ? "" : Number(val),
                      });
                    }}
                    placeholder="0.00"
                    label={isBeamMode ? "X-COORD" : "X-COORD"}
                  />
                </div>
                {!isBeamMode && (
                  <div className="relative">
                    <UnitInput
                      unitType="length"
                      preferredUnit={defaultUnits.length}
                      resetSignal={unitResetSignal}
                      disabled={startNodeIdx !== -1 || memberType === "Beam"}
                      value={startNode.y}
                      onChange={(val) => {
                        setFocusNode("start");
                        setStartNode({
                          ...startNode,
                          y: val === "" ? "" : Number(val),
                        });
                      }}
                      placeholder="0.00"
                      label="Y-COORD"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* End Node */}
            <div
              onFocus={() => setFocusNode("end")}
              className={`group bg-white/[0.02] border p-4 rounded-2xl transition-all hover:bg-white/[0.04] ${focusNode === "end" ? "border-[var(--primary)] shadow-[0_0_20px_rgba(18,164,76,0.1)]" : "border-white/5"}`}
            >
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label
                  className={`text-[10px] font-black uppercase tracking-widest transition-colors ${focusNode === "end" ? "text-[var(--primary)]" : "text-gray-500"}`}
                >
                  End Node
                </label>
                <select
                  value={endNodeIdx}
                  onFocus={() => setFocusNode("end")}
                  onChange={(e) => setEndNodeIdx(Number(e.target.value))}
                  className="w-full sm:w-auto bg-black border border-white/10 rounded-lg text-[9px] font-bold px-2 py-1 uppercase tracking-tighter text-[var(--primary)] outline-none"
                >
                  <option value={-1}>Explicit Entry</option>
                  {existingNodes.map((n, i) => (
                    <option key={i} value={i}>
                      {isBeamMode
                        ? `Anchor N${i + 1} (${n.x}m)`
                        : `N${i + 1} (${n.x}, ${n.y})m`}
                    </option>
                  ))}
                </select>
              </div>
              <div
                className={`grid grid-cols-1 ${!isBeamMode ? "sm:grid-cols-2" : ""} gap-4`}
              >
                <div className="relative">
                  <UnitInput
                    unitType="length"
                    preferredUnit={defaultUnits.length}
                    resetSignal={unitResetSignal}
                    disabled={
                      endNodeIdx !== -1 ||
                      (!isBeamMode && memberType === "Column")
                    }
                    value={endNode.x}
                    onChange={(val) => {
                      setFocusNode("end");
                      setEndNode({
                        ...endNode,
                        x: val === "" ? "" : Number(val),
                      });
                    }}
                    placeholder="10.00"
                    label={isBeamMode ? "X-COORD" : "X-COORD"}
                  />
                </div>
                {!isBeamMode && (
                  <div className="relative">
                    <UnitInput
                      unitType="length"
                      preferredUnit={defaultUnits.length}
                      resetSignal={unitResetSignal}
                      disabled={endNodeIdx !== -1 || memberType === "Beam"}
                      value={endNode.y}
                      onChange={(val) => {
                        setFocusNode("end");
                        setEndNode({
                          ...endNode,
                          y: val === "" ? "" : Number(val),
                        });
                      }}
                      placeholder="0.00"
                      label="Y-COORD"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 02: SECTION PROPERTIES */}
        <section className="space-y-5">
          <header className="flex items-center gap-4">
            <span className="text-[10px] font-black text-white bg-white/10 px-2 py-0.5 rounded">
              02
            </span>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
              Section Properties
            </h3>
            <div className="flex-1 h-px bg-white/5"></div>
          </header>

          <div className="space-y-4">
            <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                  Workflow Mode
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsDesignMode(false)}
                  className={`rounded-lg border px-3 py-2 text-[9px] font-black uppercase tracking-widest transition-colors ${
                    !isDesignMode
                      ? "border-[var(--primary)] bg-[var(--primary-glow)]/20 text-[var(--primary)]"
                      : "border-white/10 bg-black/30 text-gray-500 hover:text-gray-300"
                  }`}
                >
                  Analysis
                </button>
                <button
                  type="button"
                  onClick={() => setIsDesignMode(true)}
                  className={`rounded-lg border px-3 py-2 text-[9px] font-black uppercase tracking-widest transition-colors ${
                    isDesignMode
                      ? "border-[var(--primary)] bg-[var(--primary-glow)]/20 text-[var(--primary)]"
                      : "border-white/10 bg-black/30 text-gray-500 hover:text-gray-300"
                  }`}
                >
                  Design (RCC)
                </button>
              </div>
              <p className="text-[9px] text-gray-600 leading-relaxed px-1">
                Analysis mode uses only E and I. Design mode also enables section
                geometry for I auto-derivation and downstream RCC workflow.
              </p>
            </div>

            {isDesignMode && (
              <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"></div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Geometry
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <UnitInput
                    unitType="length"
                    preferredUnit={defaultUnits.length}
                    resetSignal={unitResetSignal}
                    value={sectionProps.b}
                    onChange={(val) =>
                      setSectionProps({ ...sectionProps, b: val })
                    }
                    label="Width (b)"
                    placeholder="0.23"
                  />
                  <UnitInput
                    unitType="length"
                    preferredUnit={defaultUnits.length}
                    resetSignal={unitResetSignal}
                    value={sectionProps.h}
                    onChange={(val) =>
                      setSectionProps({ ...sectionProps, h: val })
                    }
                    label="Depth (h)"
                    placeholder="0.45"
                  />
                  {memberType === "Beam" && (
                    <div className="sm:col-span-2">
                      <UnitInput
                        unitType="length"
                        preferredUnit={defaultUnits.length}
                        resetSignal={unitResetSignal}
                        value={sectionProps.slabThickness}
                        onChange={(val) =>
                          setSectionProps({
                            ...sectionProps,
                            slabThickness: val,
                          })
                        }
                        label="Slab Thickness"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stiffness Group */}
            <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                  Material Stiffness
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <UnitInput
                    unitType="elasticModulus"
                    preferredUnit={defaultUnits.elasticModulus}
                    resetSignal={unitResetSignal}
                    value={isEConstant ? 1 : Ecoef}
                    onChange={(val) => {
                      if (!isEConstant) setEcoef(val);
                    }}
                    constantMode={isEConstant}
                    constantValue={1}
                    label="E (Young's Modulus)"
                    placeholder="25"
                  />
                  <button
                    type="button"
                    onClick={() => setIsEConstant((prev) => !prev)}
                    className={`w-full rounded-lg border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-colors ${
                      isEConstant
                        ? "border-[var(--primary)] bg-[var(--primary-glow)]/20 text-[var(--primary)]"
                        : "border-white/10 bg-black/30 text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {isEConstant ? "E Constant x1" : "Use E Constant x1"}
                  </button>
                </div>
                <div className="space-y-2">
                  <UnitInput
                    unitType="inertia"
                    preferredUnit={defaultUnits.inertia}
                    resetSignal={unitResetSignal}
                    value={isIConstant ? 1 : Icoef}
                    onChange={(val) => {
                      if (!isIConstant) setIcoef(val);
                    }}
                    constantMode={isIConstant}
                    constantValue={1}
                    label="I (Moment of Inertia)"
                    placeholder="Auto"
                  />
                  <button
                    type="button"
                    onClick={() => setIsIConstant((prev) => !prev)}
                    className={`w-full rounded-lg border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-colors ${
                      isIConstant
                        ? "border-[var(--primary)] bg-[var(--primary-glow)]/20 text-[var(--primary)]"
                        : "border-white/10 bg-black/30 text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {isIConstant ? "I Constant x1" : "Use I Constant x1"}
                  </button>
                </div>
                <p className="sm:col-span-2 text-[9px] text-gray-600 leading-relaxed px-1">
                  Enable constant mode to lock the value at 1 regardless of
                  selected units. In Analysis mode, provide I explicitly if
                  constant mode is off.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* VECTOR FORCES */}
        <section className="space-y-5">
          <header className="flex items-center gap-4">
            <span className="text-[10px] font-black text-[var(--accent)] bg-[var(--accent-glow)] px-2 py-0.5 rounded">
              03
            </span>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
              Load Vectors
            </h3>
            <div className="flex-1 h-px bg-white/5"></div>
          </header>

          <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-6 space-y-5">
            {/* Load Form */}
            <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 bg-black/20 p-1 rounded-xl grid grid-cols-3 gap-1">
                  {(["Point", "UDL", "VDL"] as LoadType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() =>
                        setNewLoad({
                          ...newLoad,
                          type,
                          value: "",
                          position: "",
                          span: "",
                          lowPosition: "",
                          highPosition: "",
                        })
                      }
                      className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${
                        newLoad.type === type
                          ? "bg-[var(--primary)] text-black shadow-lg shadow-[var(--primary)]/20"
                          : "text-gray-500 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div>
                  <UnitInput
                    unitType={newLoad.type === "Point" ? "force" : "loading"}
                    preferredUnit={
                      newLoad.type === "Point"
                        ? defaultUnits.force
                        : defaultUnits.loading
                    }
                    resetSignal={unitResetSignal}
                    value={newLoad.value}
                    onChange={(val) => setNewLoad({ ...newLoad, value: val })}
                    label={
                      newLoad.type === "Point" ? "Force" : "Start Magnitude"
                    }
                    placeholder="0.00"
                  />
                </div>

                {newLoad.type === "Point" && (
                  <div>
                    <UnitInput
                      unitType="length"
                      preferredUnit={defaultUnits.length}
                      resetSignal={unitResetSignal}
                      value={newLoad.position}
                      onChange={(val) =>
                        setNewLoad({ ...newLoad, position: val })
                      }
                      label="Position (from left)"
                      placeholder="0.00"
                    />
                  </div>
                )}

                {newLoad.type === "UDL" && (
                  <>
                    <div>
                      <UnitInput
                        unitType="length"
                        preferredUnit={defaultUnits.length}
                        resetSignal={unitResetSignal}
                        value={newLoad.position}
                        onChange={(val) =>
                          setNewLoad({ ...newLoad, position: val })
                        }
                        label="Start Position"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <UnitInput
                        unitType="length"
                        preferredUnit={defaultUnits.length}
                        resetSignal={unitResetSignal}
                        value={newLoad.span}
                        onChange={(val) =>
                          setNewLoad({ ...newLoad, span: val })
                        }
                        label="Span Length"
                        placeholder="0.00"
                      />
                    </div>
                  </>
                )}

                {newLoad.type === "VDL" && (
                  <>
                    <div>
                      <UnitInput
                        unitType="length"
                        preferredUnit={defaultUnits.length}
                        resetSignal={unitResetSignal}
                        value={newLoad.lowPosition}
                        onChange={(val) =>
                          setNewLoad({ ...newLoad, lowPosition: val })
                        }
                        label="Low Pos"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <UnitInput
                        unitType="length"
                        preferredUnit={defaultUnits.length}
                        resetSignal={unitResetSignal}
                        value={newLoad.highPosition}
                        onChange={(val) =>
                          setNewLoad({ ...newLoad, highPosition: val })
                        }
                        label="High Pos"
                        placeholder="0.00"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-[var(--accent)] ml-1 block mb-2">
                    Vector Angle (deg)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={newLoad.angle}
                      onChange={(e) =>
                        setNewLoad({
                          ...newLoad,
                          angle:
                            e.target.value === "" ? "" : Number(e.target.value),
                        })
                      }
                      className="no-spinner w-full bg-black border border-[var(--accent)]/30 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-[var(--accent)] bg-[var(--accent-glow)]/5"
                      placeholder="90"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-[var(--accent)]">
                      deg
                    </span>
                  </div>
                </div>
                <div className="flex flex-col justify-end">
                  <div className="grid grid-cols-4 gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                    {[0, 90, 180, 270].map((a) => (
                      <button
                        key={a}
                        onClick={() =>
                          setNewLoad((prev) => ({ ...prev, angle: a }))
                        }
                        className={`flex-1 py-1 rounded-md text-[9px] font-bold transition-all ${newLoad.angle === a ? "bg-[var(--accent)] text-white" : "text-gray-600 hover:text-gray-400"}`}
                      >
                        {a}deg
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={addLoad}
                className="w-full py-3 bg-[var(--accent)] text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:brightness-110 transition-all shadow-lg shadow-[var(--accent-glow)]"
              >
                Inject Vector Force
              </button>
            </div>

            {loads.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/5">
                {loads.map((load) => (
                  <div
                    key={load.id}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-black/60 p-3 rounded-xl border border-white/5 group/load"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-gray-300">
                          {load.type}{" "}
                          {load.type === "VDL"
                            ? `@ ${load.lowPosition}-${load.highPosition}m`
                            : `@ ${load.position}m`}
                        </span>
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-white/5 text-gray-500 italic uppercase">
                          {load.angle}deg Vector
                        </span>
                      </div>
                      <span className="text-[12px] font-bold text-[var(--accent)]">
                        {load.value}kN{load.type !== "Point" ? "/m" : ""}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        setLoads(loads.filter((l) => l.id !== load.id))
                      }
                      className="p-1.5 opacity-0 group-hover/load:opacity-100 hover:bg-white/10 rounded-lg transition-all text-gray-500"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* SUPPORT CONDITIONS */}
        <section className="space-y-5">
          <header className="flex items-center gap-4">
            <span className="text-[10px] font-black text-white bg-white/10 px-2 py-0.5 rounded">
              04
            </span>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
              Support Matrix
            </h3>
            <div className="flex-1 h-px bg-white/5"></div>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
              <label className="text-[9px] font-black uppercase text-gray-600 block mb-2 ml-1">
                Start Node
              </label>
              <select
                value={supports.start}
                onChange={(e) =>
                  setSupports({
                    ...supports,
                    start: e.target.value as SupportType,
                  })
                }
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-tighter text-[var(--primary)] outline-none focus:border-[var(--primary)]"
              >
                <option value="None">None</option>
                <option value="Fixed">Fixed</option>
                <option value="Pinned">Pinned</option>
                <option value="Roller">Roller</option>
              </select>
            </div>
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
              <label className="text-[9px] font-black uppercase text-gray-600 block mb-2 ml-1">
                End Node
              </label>
              <select
                value={supports.end}
                onChange={(e) =>
                  setSupports({
                    ...supports,
                    end: e.target.value as SupportType,
                  })
                }
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-tighter text-[var(--primary)] outline-none focus:border-[var(--primary)]"
              >
                <option value="None">None</option>
                <option value="Fixed">Fixed</option>
                <option value="Pinned">Pinned</option>
                <option value="Roller">Roller</option>
              </select>
            </div>
          </div>
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div>
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                  Prior Settlements
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setUseSettlements((prev) => {
                    const next = !prev;
                    if (!next) {
                      setSettlement({ start: "", end: "" });
                    }
                    return next;
                  })
                }
                className={`rounded-lg border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-colors ${
                  useSettlements
                    ? "border-[var(--primary)] bg-[var(--primary-glow)]/20 text-[var(--primary)]"
                    : "border-white/10 bg-black/30 text-gray-500 hover:text-gray-300"
                }`}
              >
                {useSettlements ? "Enabled" : "Disabled"}
              </button>
            </div>

            {useSettlements && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <UnitInput
                  unitType="length"
                  preferredUnit={defaultUnits.length}
                  resetSignal={unitResetSignal}
                  value={settlement.start}
                  onChange={(val) =>
                    setSettlement({ ...settlement, start: val })
                  }
                  label="Start Node Settlement"
                  placeholder="0.00"
                />
                <UnitInput
                  unitType="length"
                  preferredUnit={defaultUnits.length}
                  resetSignal={unitResetSignal}
                  value={settlement.end}
                  onChange={(val) => setSettlement({ ...settlement, end: val })}
                  label="End Node Settlement"
                  placeholder="0.00"
                />
              </div>
            )}
          </div>
          <p className="text-[10px] text-gray-600 italic px-2 leading-relaxed">
            Supports sync from linked nodes. Settlements are optional and stay
            zero unless enabled.
          </p>
        </section>

        <div className="p-2 border-t border-white/5 pt-8">
          <button
            onClick={createMember}
            className="w-full py-4 sm:py-5 bg-[var(--primary)] text-white font-black uppercase text-xs tracking-[0.2em] sm:tracking-[0.3em] rounded-[2rem] shadow-3xl shadow-[var(--primary-glow)] transition-all hover:translate-y-[-2px] hover:scale-[1.02] active:translate-y-[1px]"
          >
            {initialData ? "Apply Refinement" : "Finalize Protocol"}
          </button>
        </div>
      </div>
    </div>
  );
}

