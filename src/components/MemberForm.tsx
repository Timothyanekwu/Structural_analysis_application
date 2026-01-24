"use client";

import { useState, useEffect } from "react";
import StructurePreview, { Member, Load } from "./StructurePreview";

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
}

export default function MemberForm({ mode = "beams", onSuccess, initialStartNode, existingNodes = [], nodeSupports = {}, initialData }: MemberFormProps) {
  const isBeamMode = mode === "beams";
  
  // Logic for finding initial selected node index
  const findNodeIndex = (p?: { x: number; y: number }) => {
    if (!p) return -1;
    return existingNodes.findIndex(n => n.x === p.x && n.y === p.y);
  };

  const [memberType, setMemberType] = useState<"Beam" | "Column" | "Inclined">(
    isBeamMode ? "Beam" : ((initialData?.memberType as any) || "Beam")
  );

  const [startNodeIdx, setStartNodeIdx] = useState<number>(findNodeIndex(initialData?.startNode || initialStartNode));
  const [endNodeIdx, setEndNodeIdx] = useState<number>(findNodeIndex(initialData?.endNode));

  const [startNode, setStartNode] = useState<Point>(
    initialData?.startNode 
      ? { x: initialData.startNode.x, y: initialData.startNode.y } 
      : (initialStartNode ? { x: initialStartNode.x, y: initialStartNode.y } : { x: "", y: "" })
  );
  const [endNode, setEndNode] = useState<Point>(
    initialData?.endNode 
      ? { x: initialData.endNode.x, y: initialData.endNode.y } 
      : { x: "", y: "" }
  );
  
  const [supports, setSupports] = useState<{ start: SupportType; end: SupportType }>(
    initialData?.supports || { start: "None", end: "None" }
  );
  const [settlement, setSettlement] = useState<{ start: number | ""; end: number | "" }>({
    start: initialData?.supports?.startSettlement || "",
    end: initialData?.supports?.endSettlement || ""
  });

  const [loads, setLoads] = useState<Load[]>(initialData?.loads || []);
  const [newLoad, setNewLoad] = useState<{ type: LoadType; value: number | ""; position: number | ""; span: number | ""; angle: number | ""; lowPosition: number | ""; highPosition: number | "" }>({ 
    type: "Point", 
    value: "", 
    position: "",
    span: "",
    angle: 90,
    lowPosition: "",
    highPosition: ""
  });

  const [Ecoef, setEcoef] = useState<number | "">(initialData?.Ecoef ?? 1);
  const [Icoef, setIcoef] = useState<number | "">(initialData?.Icoef ?? 1);

  const [focusNode, setFocusNode] = useState<"start" | "end" | null>(null);

  // Smart Alignment Enforcement
  useEffect(() => {
    if (memberType === "Beam") {
      // Horizontal Lock: Y coordinates must match
      if (startNode.y !== endNode.y && startNode.y !== "" && endNode.y !== "") {
        // If we just changed start, update end. Otherwise update start.
        if (focusNode === "start") setEndNode(prev => ({ ...prev, y: startNode.y }));
        else if (focusNode === "end") setStartNode(prev => ({ ...prev, y: endNode.y }));
      }
    } else if (memberType === "Column") {
      // Vertical Lock: X coordinates must match
      if (startNode.x !== endNode.x && startNode.x !== "" && endNode.x !== "") {
        if (focusNode === "start") setEndNode(prev => ({ ...prev, x: startNode.x }));
        else if (focusNode === "end") setStartNode(prev => ({ ...prev, x: endNode.x }));
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
        setEndNode(prev => ({ ...prev, x: n.x }));
      } else if (memberType === "Beam") {
        setEndNode(prev => ({ ...prev, y: n.y }));
      }

      const sData = nodeSupports[JSON.stringify(n)];
      if (sData) {
        if (typeof sData === 'string') {
           setSupports(prev => ({ ...prev, start: sData as SupportType }));
           setSettlement(prev => ({ ...prev, start: "" })); 
        } else {
           setSupports(prev => ({ ...prev, start: sData.type as SupportType }));
           setSettlement(prev => ({ ...prev, start: sData.settlement ?? "" }));
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
        setStartNode(prev => ({ ...prev, x: n.x }));
      } else if (memberType === "Beam") {
        setStartNode(prev => ({ ...prev, y: n.y }));
      }

      const sData = nodeSupports[JSON.stringify(n)];
      if (sData) {
        if (typeof sData === 'string') {
           setSupports(prev => ({ ...prev, end: sData as SupportType }));
           setSettlement(prev => ({ ...prev, end: "" })); 
        } else {
           setSupports(prev => ({ ...prev, end: sData.type as SupportType }));
           setSettlement(prev => ({ ...prev, end: sData.settlement ?? "" }));
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
        position: newLoad.type === "VDL" ? Number(newLoad.highPosition || 0) : Number(newLoad.position || 0),
        span: newLoad.type === "UDL" ? Number(newLoad.span || 0) : undefined,
        angle: Number(newLoad.angle || 90),
        // VDL specific
        highValue: newLoad.type === "VDL" ? Number(newLoad.value) : undefined,
        highPosition: newLoad.type === "VDL" ? Number(newLoad.highPosition || 0) : undefined,
        lowPosition: newLoad.type === "VDL" ? Number(newLoad.lowPosition || 0) : undefined,
      },
    ]);
    setNewLoad({ type: "Point", value: "", position: "", span: "", angle: 90, lowPosition: "", highPosition: "" });
  };

  const createMember = () => {
    const memberData = {
      startNode: { x: Number(startNode.x || 0), y: isBeamMode ? 0 : Number(startNode.y || 0) },
      endNode: { x: Number(endNode.x || 0), y: isBeamMode ? 0 : Number(endNode.y || 0) },
      memberType: isBeamMode ? "Beam" : memberType,
      supports: { 
        ...supports, 
        startSettlement: Number(settlement.start || 0),
        endSettlement: Number(settlement.end || 0)
      },
      loads,
      Ecoef: Number(Ecoef || 1),
      Icoef: Number(Icoef || 1),
    };
    if (onSuccess) onSuccess(memberData);
  };
  
  const currentPreviewMember: Member = {
    startNode: { x: Number(startNode.x || 0), y: isBeamMode ? 0 : Number(startNode.y || 0) },
    endNode: { x: Number(endNode.x || 0), y: isBeamMode ? 0 : Number(endNode.y || 0) },
    memberType: isBeamMode ? "Beam" : memberType,
    supports: { ...supports, startSettlement: Number(settlement.start || 0), endSettlement: Number(settlement.end || 0) },
    loads: loads,
    Ecoef: Number(Ecoef || 1),
    Icoef: Number(Icoef || 1),
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-0 w-full min-h-[70vh] bg-[#050505] text-white overflow-hidden">
       {/* Visual Feedback (Left 3/5) */}
       <div className="lg:col-span-3 bg-black/40 p-6 flex flex-col relative border-r border-white/5">
         <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse shadow-[0_0_8px_var(--primary-glow)]"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Geometry Kernel Preview</span>
         </div>
         <div className="flex-1 rounded-3xl overflow-hidden border border-white/5 bg-black/20 shadow-inner">
             <StructurePreview 
               members={[currentPreviewMember]} 
               highlightNode={focusNode === "start" ? { x: Number(startNode.x || 0), y: Number(startNode.y || 0) } : focusNode === "end" ? { x: Number(endNode.x || 0), y: Number(endNode.y || 0) } : null}
             />
         </div>
         <div className="mt-4 flex justify-between items-center text-[9px] uppercase font-bold text-gray-600 tracking-widest">
            <span>Precision: 64-bit float</span>
            <span>State: {initialData ? "RE-EDITING" : "INITIAL_DEFINITION"}</span>
         </div>
       </div>

      {/* Controller (Right 2/5) */}
      <div className="lg:col-span-2 p-8 space-y-10 overflow-y-auto max-h-[85vh] custom-scrollbar">
        <header>
          <h2 className="text-3xl font-black tracking-tighter gradient-text uppercase mb-1">
            {initialData ? "Sync Config" : "Init Matrix"}
          </h2>
          <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">{isBeamMode ? "Beam" : "Member"} Definition Protocol</p>
        </header>

        {/* SECTION 00: MEMBER TYPE - Only for Frames */}
        {!isBeamMode && (
          <section className="space-y-6">
            <header className="flex items-center gap-4">
              <span className="text-[10px] font-black text-white bg-white/10 px-2 py-0.5 rounded">00</span>
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Member Type</h3>
              <div className="flex-1 h-px bg-white/5"></div>
            </header>

            <div className="flex gap-2">
              {["Beam", "Column", "Inclined"].map((type) => (
                <button
                  key={type}
                  onClick={() => setMemberType(type as any)}
                  className={`flex-1 py-3 rounded-xl border text-[10px] font-black uppercase transition-all duration-300 ${
                    memberType === type 
                      ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-lg shadow-[var(--primary-glow)]' 
                      : 'bg-white/[0.02] border-white/5 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* GEOMETRY KERNEL */}
        <section className="space-y-6">
          <header className="flex items-center gap-4">
            <span className="text-[10px] font-black text-[var(--primary)] bg-[var(--primary-glow)] px-2 py-0.5 rounded">01</span>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Spatial Coordinates</h3>
            <div className="flex-1 h-px bg-white/5"></div>
          </header>

          <div className="space-y-6">
            {/* Start Node */}
            <div 
              onFocus={() => setFocusNode("start")}
              className={`group bg-white/[0.02] border p-4 rounded-2xl transition-all hover:bg-white/[0.04] ${focusNode === "start" ? 'border-[var(--primary)] shadow-[0_0_20px_rgba(18,164,76,0.1)]' : 'border-white/5'}`}
            >
              <div className="flex justify-between items-center mb-4">
                <label className={`text-[10px] font-black uppercase tracking-widest transition-colors ${focusNode === "start" ? 'text-[var(--primary)]' : 'text-gray-500'}`}>Start Node</label>
                <select 
                  value={startNodeIdx}
                  onFocus={() => setFocusNode("start")}
                  onChange={(e) => setStartNodeIdx(Number(e.target.value))}
                  className="bg-black border border-white/10 rounded-lg text-[9px] font-bold px-2 py-1 uppercase tracking-tighter text-[var(--primary)] outline-none"
                >
                  <option value={-1}>Explicit Entry</option>
                  {existingNodes.map((n, i) => (
                    <option key={i} value={i}>{isBeamMode ? `Anchor N${i+1} (${n.x}m)` : `N${i+1} (${n.x}, ${n.y})m`}</option>
                  ))}
                </select>
              </div>
              
              <div className={`grid ${isBeamMode ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
                <div className="relative">
                  <input
                    type="number"
                    disabled={startNodeIdx !== -1 || (!isBeamMode && memberType === "Column")}
                    value={startNode.x}
                    onFocus={() => setFocusNode("start")}
                    onChange={(e) => setStartNode({ ...startNode, x: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="no-spinner w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-[var(--primary)] transition-colors disabled:opacity-30"
                    placeholder="0.00"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-gray-700 uppercase">{isBeamMode ? "Meters (X)" : "X (m)"}</span>
                </div>
                {!isBeamMode && (
                  <div className="relative">
                    <input
                      type="number"
                      disabled={startNodeIdx !== -1 || memberType === "Beam"}
                      value={startNode.y}
                      onFocus={() => setFocusNode("start")}
                      onChange={(e) => setStartNode({ ...startNode, y: e.target.value === "" ? "" : Number(e.target.value) })}
                      className="no-spinner w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-[var(--primary)] transition-colors disabled:opacity-30"
                      placeholder="0.00"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-gray-700 uppercase">Y (m)</span>
                  </div>
                )}
              </div>
            </div>

            {/* End Node */}
            <div 
              onFocus={() => setFocusNode("end")}
              className={`group bg-white/[0.02] border p-4 rounded-2xl transition-all hover:bg-white/[0.04] ${focusNode === "end" ? 'border-[var(--primary)] shadow-[0_0_20px_rgba(18,164,76,0.1)]' : 'border-white/5'}`}
            >
              <div className="flex justify-between items-center mb-4">
                <label className={`text-[10px] font-black uppercase tracking-widest transition-colors ${focusNode === "end" ? 'text-[var(--primary)]' : 'text-gray-500'}`}>End Node</label>
                <select 
                  value={endNodeIdx}
                  onFocus={() => setFocusNode("end")}
                  onChange={(e) => setEndNodeIdx(Number(e.target.value))}
                  className="bg-black border border-white/10 rounded-lg text-[9px] font-bold px-2 py-1 uppercase tracking-tighter text-[var(--primary)] outline-none"
                >
                  <option value={-1}>Explicit Entry</option>
                  {existingNodes.map((n, i) => (
                    <option key={i} value={i}>{isBeamMode ? `Anchor N${i+1} (${n.x}m)` : `N${i+1} (${n.x}, ${n.y})m`}</option>
                  ))}
                </select>
              </div>
              <div className={`grid ${isBeamMode ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
                <div className="relative">
                  <input
                    type="number"
                    disabled={endNodeIdx !== -1 || (!isBeamMode && memberType === "Column")}
                    value={endNode.x}
                    onFocus={() => setFocusNode("end")}
                    onChange={(e) => setEndNode({ ...endNode, x: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="no-spinner w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-[var(--primary)] transition-colors disabled:opacity-30"
                    placeholder="10.00"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-gray-700 uppercase">{isBeamMode ? "Meters (X)" : "X (m)"}</span>
                </div>
                {!isBeamMode && (
                  <div className="relative">
                    <input
                      type="number"
                      disabled={endNodeIdx !== -1 || memberType === "Beam"}
                      value={endNode.y}
                      onFocus={() => setFocusNode("end")}
                      onChange={(e) => setEndNode({ ...endNode, y: e.target.value === "" ? "" : Number(e.target.value) })}
                      className="no-spinner w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-[var(--primary)] transition-colors disabled:opacity-30"
                      placeholder="0.00"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-gray-700 uppercase">Y (m)</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 02: SECTION PROPERTIES */}
        <section className="space-y-6">
          <header className="flex items-center gap-4">
            <span className="text-[10px] font-black text-white bg-white/10 px-2 py-0.5 rounded">02</span>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Section Properties</h3>
            <div className="flex-1 h-px bg-white/5"></div>
          </header>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
              <label className="text-[9px] font-black uppercase text-gray-600 block mb-2 ml-1">E (Young's Modulus)</label>
              <div className="relative">
                <input
                  type="number"
                  value={Ecoef}
                  onChange={(e) => setEcoef(e.target.value === "" ? "" : Number(e.target.value))}
                  className="no-spinner w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-[var(--primary)]"
                  placeholder="1.0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-700">Multiplier</span>
              </div>
            </div>
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
              <label className="text-[9px] font-black uppercase text-gray-600 block mb-2 ml-1">I (Inertia)</label>
              <div className="relative">
                <input
                  type="number"
                  value={Icoef}
                  onChange={(e) => setIcoef(e.target.value === "" ? "" : Number(e.target.value))}
                  className="no-spinner w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-[var(--primary)]"
                  placeholder="1.0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-700">Multiplier</span>
              </div>
            </div>
          </div>
        </section>

        {/* VECTOR FORCES */}
        <section className="space-y-6">
          <header className="flex items-center gap-4">
            <span className="text-[10px] font-black text-[var(--accent)] bg-[var(--accent-glow)] px-2 py-0.5 rounded">02</span>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Load Vectors</h3>
            <div className="flex-1 h-px bg-white/5"></div>
          </header>
          <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-6 space-y-5">
            {/* Load Type Toggle - Fixed at top for context */}
            <div className="flex items-center gap-3 mb-6">
              <button 
                onClick={() => setNewLoad(prev => ({ ...prev, type: "Point" }))}
                className={`flex-1 py-2 rounded-lg border text-[10px] font-black uppercase transition-all ${newLoad.type === "Point" ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg shadow-[var(--accent-glow)]' : 'border-white/5 text-gray-600 hover:text-white'}`}
              >
                Point Load
              </button>
              <button 
                onClick={() => setNewLoad(prev => ({ ...prev, type: "UDL" }))}
                className={`flex-1 py-2 rounded-lg border text-[10px] font-black uppercase transition-all ${newLoad.type === "UDL" ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg shadow-[var(--accent-glow)]' : 'border-white/5 text-gray-600 hover:text-white'}`}
              >
                UDL (Dist)
              </button>
              <button 
                onClick={() => setNewLoad(prev => ({ ...prev, type: "VDL" }))}
                className={`flex-1 py-2 rounded-lg border text-[10px] font-black uppercase transition-all ${newLoad.type === "VDL" ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg shadow-[var(--accent-glow)]' : 'border-white/5 text-gray-600 hover:text-white'}`}
              >
                VDL (Tri)
              </button>
            </div>

            {newLoad.type === "VDL" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-gray-500 ml-1">Peak Magnitude (kN/m)</label>
                  <input
                    type="number"
                    value={newLoad.value}
                    onChange={(e) => setNewLoad({ ...newLoad, value: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="no-spinner w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-[var(--accent)] shadow-sm"
                    placeholder="0.0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-gray-500 ml-1">Peak Pos (m)</label>
                  <input
                    type="number"
                    value={newLoad.highPosition}
                    onChange={(e) => setNewLoad({ ...newLoad, highPosition: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="no-spinner w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-[var(--accent)]"
                    placeholder="0.0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-gray-500 ml-1">Zero Pos (m)</label>
                  <input
                    type="number"
                    value={newLoad.lowPosition}
                    onChange={(e) => setNewLoad({ ...newLoad, lowPosition: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="no-spinner w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-[var(--accent)]"
                    placeholder="0.0"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-gray-500 ml-1">Magnitude (kN)</label>
                  <input
                    type="number"
                    value={newLoad.value}
                    onChange={(e) => setNewLoad({ ...newLoad, value: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="no-spinner w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-[var(--accent)] shadow-sm"
                    placeholder="0.0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-gray-500 ml-1">Position (m)</label>
                  <input
                    type="number"
                    value={newLoad.position}
                    onChange={(e) => setNewLoad({ ...newLoad, position: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="no-spinner w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-[var(--accent)]"
                    placeholder="0.0"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-[var(--accent)] ml-1">Vector Angle (°)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={newLoad.angle}
                    onChange={(e) => setNewLoad({ ...newLoad, angle: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="no-spinner w-full bg-black border border-[var(--accent)]/30 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-[var(--accent)] bg-[var(--accent-glow)]/5"
                    placeholder="90"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-[var(--accent)]">°</span>
                </div>
              </div>
              <div className="flex flex-col justify-end">
                 <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                    {[0, 90, 180, 270].map(a => (
                      <button 
                        key={a}
                        onClick={() => setNewLoad(prev => ({ ...prev, angle: a }))}
                        className={`flex-1 py-1 rounded-md text-[9px] font-bold transition-all ${newLoad.angle === a ? 'bg-[var(--accent)] text-white' : 'text-gray-600 hover:text-gray-400'}`}
                      >
                        {a}°
                      </button>
                    ))}
                 </div>
              </div>
            </div>

            {newLoad.type === "UDL" && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-[9px] font-black uppercase text-gray-500 ml-1 mb-2 block">Span Length (m)</label>
                <input
                  type="number"
                  value={newLoad.span}
                  onChange={(e) => setNewLoad({ ...newLoad, span: e.target.value === "" ? "" : Number(e.target.value) })}
                  className="no-spinner w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-[var(--accent)]"
                  placeholder="Total span"
                />
              </div>
            )}

            <button 
              onClick={addLoad}
              className="w-full py-3 bg-[var(--accent)] text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:brightness-110 transition-all shadow-lg shadow-[var(--accent-glow)]"
            >
              Inject Vector Force
            </button>

            {loads.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/5">
                {loads.map((load) => (
                  <div key={load.id} className="flex items-center justify-between bg-black/60 p-3 rounded-xl border border-white/5 group/load">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-gray-300">
                          {load.type} {load.type === "VDL" ? `@ ${load.lowPosition}-${load.highPosition}m` : `@ ${load.position}m`}
                        </span>
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-white/5 text-gray-500 italic uppercase">{load.angle}° Vector</span>
                      </div>
                      <span className="text-[12px] font-bold text-[var(--accent)]">{load.value}kN{load.type !== "Point" ? "/m" : ""}</span>
                    </div>
                    <button 
                      onClick={() => setLoads(loads.filter(l => l.id !== load.id))}
                      className="p-1.5 opacity-0 group-hover/load:opacity-100 hover:bg-white/10 rounded-lg transition-all text-gray-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* SUPPORT CONDITIONS */}
        <section className="space-y-6">
          <header className="flex items-center gap-4">
            <span className="text-[10px] font-black text-white bg-white/10 px-2 py-0.5 rounded">03</span>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Support Matrix</h3>
            <div className="flex-1 h-px bg-white/5"></div>
          </header>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
              <label className="text-[9px] font-black uppercase text-gray-600 block mb-2 ml-1">Start Node</label>
              <select
                value={supports.start}
                onChange={(e) => setSupports({ ...supports, start: e.target.value as SupportType })}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-tighter text-[var(--primary)] outline-none focus:border-[var(--primary)]"
              >
                <option value="None">None</option>
                <option value="Fixed">Fixed</option>
                <option value="Pinned">Pinned</option>
                <option value="Roller">Roller</option>
              </select>
              {isBeamMode && supports.start !== "None" && (
                <div className="mt-3 animate-in fade-in slide-in-from-top-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 block mb-1 ml-1">Settlement (m)</label>
                  <input
                    type="number"
                    value={settlement.start}
                    onChange={(e) => setSettlement({ ...settlement, start: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="no-spinner w-full bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-[var(--primary)] text-[var(--primary)]"
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
              <label className="text-[9px] font-black uppercase text-gray-600 block mb-2 ml-1">End Node</label>
              <select
                value={supports.end}
                onChange={(e) => setSupports({ ...supports, end: e.target.value as SupportType })}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-tighter text-[var(--primary)] outline-none focus:border-[var(--primary)]"
              >
                <option value="None">None</option>
                <option value="Fixed">Fixed</option>
                <option value="Pinned">Pinned</option>
                <option value="Roller">Roller</option>
              </select>
              {isBeamMode && supports.end !== "None" && (
                <div className="mt-3 animate-in fade-in slide-in-from-top-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 block mb-1 ml-1">Settlement (m)</label>
                  <input
                    type="number"
                    value={settlement.end}
                    onChange={(e) => setSettlement({ ...settlement, end: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="no-spinner w-full bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-[var(--primary)] text-[var(--primary)]"
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>
          </div>
          <p className="text-[10px] text-gray-600 italic px-2 leading-relaxed">System automatically syncs supports when linking to existing nodes.</p>
        </section>

        <div className="p-2 border-t border-white/5 pt-8">
           <button
            onClick={createMember}
            className="w-full py-5 bg-[var(--primary)] text-white font-black uppercase text-xs tracking-[0.3em] rounded-[2rem] shadow-3xl shadow-[var(--primary-glow)] transition-all hover:translate-y-[-2px] hover:scale-[1.02] active:translate-y-[1px]"
          >
            {initialData ? "Apply Refinement" : "Finalize Protocol"}
          </button>
        </div>
      </div>
    </div>
  );
}
