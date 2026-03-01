"use client";

import { Suspense, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import MemberForm from "@/components/MemberForm";
import Modal from "@/components/Modal";
import Link from "next/link";
import StructurePreview, { Member } from "@/components/StructurePreview";
import {
  BeamInternalForcePoint,
  BeamSolver,
} from "@_lib/beamSolver/beamSolver";
import { FrameSolver } from "@_lib/frameSolver/frameSolver";
import { Node as SolverNode } from "@_lib/elements/node";
import { Beam, Column, InclinedMember } from "@_lib/elements/member";
import {
  FixedSupport,
  PinnedSupport,
  RollerSupport,
  Support as SolverSupport,
} from "@_lib/elements/support";
import { FixedEndMoments } from "@_lib/logic/FEMs";
import {
  PointLoad as SolverPointLoad,
  UDL as SolverUDL,
  VDL as SolverVDL,
} from "@_lib/elements/load";
import {
  RCCDesignFormulaes,
  SpanSectionType,
  ZonedBeamDesignResult,
} from "@_lib/RCCDesign/RCCDesignFormulaes";
import {
  DesignResult as ColumnDesignResult,
  designShortBracedColumn,
} from "@_lib/RCCDesign/columnDesign";
import type { ShearZone } from "@_lib/RCCDesign/ShearDesignEngine";
import DiagramsSection from "@/components/DiagramsSection";
import { calculateDiagramData } from "@/utils/diagramUtils";
import { MemberDiagramData } from "@/components/FrameDiagramOverlay";
import {
  ForceUnit,
  LengthUnit,
  MomentUnit,
  convertForce,
  convertLength,
  convertMoment,
} from "@/utils/unitUtils";
import {
  AppUnitPreference,
  loadStoredDefaultUnits,
} from "@/utils/unitPreferences";

type ResultUnitPreference = {
  force: ForceUnit;
  length: LengthUnit;
  moment: MomentUnit;
};

type SolveReaction = { id: string; x?: number; y: number; m?: number };
type BeamMemberDiagram = { span: string; data: BeamInternalForcePoint[] };
type FrontJointAction = NonNullable<Member["jointActions"]>["start"];
type ProvidedBars = {
  count: number;
  diameter: number;
  area: number;
  label: string;
};
type LimitCheckSummary = {
  status: "OK" | "CHECK" | "NA";
  message: string;
  actual: number | null;
  limit: number | null;
  units: string;
  note?: string;
};
type BeamDesignSummary = {
  memberLabel: string;
  status: "OK" | "CHECK" | "ERROR";
  message: string;
  supportMoment: number | null;
  spanMoment: number | null;
  flexure: ZonedBeamDesignResult | null;
  supportBars: ProvidedBars | null;
  spanBars: ProvidedBars | null;
  shearZones: ShearZone[];
  deflectionCheck: LimitCheckSummary;
  crackWidthCheck: LimitCheckSummary;
};
type SupportDesignSummary = {
  supportLabel: string;
  status: "OK" | "CHECK" | "ERROR";
  message: string;
  governingMoment: number | null;
  connectedMembers: string[];
  d: number | null;
  AsMin: number | null;
  AsMax: number | null;
  K: number | null;
  z: number | null;
  x: number | null;
  AsRequired: number | null;
  AsProvided: ProvidedBars | null;
};
type ColumnDesignSummary = {
  memberLabel: string;
  status: "SUCCESS" | "TERMINATED" | "SKIPPED";
  message: string;
  axialLoadUsed: number | null;
  result: ColumnDesignResult | null;
};
type DesignCheckStatus = "IMPLEMENTED" | "PARTIAL" | "MISSING";
type DesignCheckCoverage = {
  id: string;
  name: string;
  status: DesignCheckStatus;
  notes: string;
};
type DesignResults = {
  assumptions: {
    fcu: number;
    fy: number;
    concreteCover_mm: number;
    linkDiameter_mm: number;
    mainBarDiameter_mm: number;
    fyv: number;
    linkBarDiameter_mm: number;
    linkLegCount: number;
  };
  checks: DesignCheckCoverage[];
  beams: BeamDesignSummary[];
  supports: SupportDesignSummary[];
  columns: ColumnDesignSummary[];
};
type SolveResults = {
  fems: { span: string; start: number; end: number }[];
  endMoments: { span: string; left: number; right: number }[];
  reactions: SolveReaction[];
  frameSidesway: boolean | null;
  beamDiagrams: BeamMemberDiagram[];
  design: DesignResults;
};

const DESIGN_ASSUMPTIONS: DesignResults["assumptions"] = {
  fcu: 30,
  fy: 460,
  concreteCover_mm: 25,
  linkDiameter_mm: 10,
  mainBarDiameter_mm: 16,
  fyv: 460,
  linkBarDiameter_mm: 8,
  linkLegCount: 2,
};

const DESIGN_CHECK_COVERAGE: DesignCheckCoverage[] = [
  {
    id: "beam-flexure-zones",
    name: "Beam flexural design (support/span)",
    status: "IMPLEMENTED",
    notes: "K, z, x, As(req), As(prov) are computed for support and span zones.",
  },
  {
    id: "beam-shear-zones",
    name: "Beam shear zoning checks",
    status: "IMPLEMENTED",
    notes:
      "SFD-based zones are evaluated with OK/WARNING/FAIL and spacing instructions.",
  },
  {
    id: "beam-min-steel",
    name: "Beam minimum steel",
    status: "IMPLEMENTED",
    notes: "As,min is computed and enforced when selecting required tension steel.",
  },
  {
    id: "beam-max-steel",
    name: "Beam maximum steel",
    status: "PARTIAL",
    notes: "As,max is computed/displayed, but no hard fail/termination is applied.",
  },
  {
    id: "beam-deflection",
    name: "Beam deflection control (span/depth)",
    status: "PARTIAL",
    notes:
      "Implemented as L/d screening with BS 8110 basic ratio limits (without modification factors).",
  },
  {
    id: "beam-crack-width",
    name: "Beam crack width screening",
    status: "PARTIAL",
    notes:
      "Implemented with a service-stress-based estimated crack width for rapid screening.",
  },
  {
    id: "column-short-braced",
    name: "Short braced column design",
    status: "IMPLEMENTED",
    notes:
      "Slenderness gate, min/max steel checks, bar/link selection are implemented.",
  },
  {
    id: "column-slender-design",
    name: "Slender column design",
    status: "MISSING",
    notes:
      "Current flow terminates when column is slender and requests slender-column module.",
  },
];

function AnalysisContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("type") || "beams";
  const isFrameMode = mode === "frames";

  const [activeModal, setActiveModal] = useState<"none" | "member" | "solve">(
    "none",
  );
  const [members, setMembers] = useState<Member[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [solveData, setSolveData] = useState<string>("");
  const [solveResults, setSolveResults] = useState<SolveResults | null>(null);
  const [activeDiagram, setActiveDiagram] = useState<
    "bmd" | "sfd" | "both" | "none"
  >("none");
  const [defaultUnits] = useState<AppUnitPreference>(loadStoredDefaultUnits);
  const [resultUnits, setResultUnits] = useState<ResultUnitPreference>(() => {
    const initialDefaults = loadStoredDefaultUnits();
    return {
      force: initialDefaults.force,
      length: initialDefaults.length,
      moment: initialDefaults.moment,
    };
  });

  // Compute diagram data for overlay when solve results are available
  const diagramData: MemberDiagramData[] = useMemo(() => {
    if (!solveResults || !members.length) return [];
    if (!isFrameMode && solveResults.beamDiagrams.length) {
      return solveResults.beamDiagrams.map((entry, index) => ({
        memberIndex: index,
        data: entry.data,
      }));
    }

    return members.map((member, index) => {
      const moments = solveResults.endMoments[index];
      const data = calculateDiagramData(member, {
        leftMoment: moments?.left || 0,
        rightMoment: moments?.right || 0,
      });
      return { memberIndex: index, data };
    });
  }, [isFrameMode, members, solveResults]);

  const handleCreateMember = (data: any) => {
    if (editingIndex !== null) {
      const updated = [...members];
      updated[editingIndex] = data;
      setMembers(updated);
      setEditingIndex(null);
    } else {
      setMembers([...members, data]);
    }
    setActiveModal("none");
  };

  const openEditModal = (index: number) => {
    setEditingIndex(index);
    setActiveModal("member");
  };

  const closeModal = () => {
    setActiveModal("none");
    setEditingIndex(null);
  };

  const lastMember = members[members.length - 1];
  const suggestedStart = useMemo(
    () => (lastMember ? lastMember.endNode : undefined),
    [lastMember],
  );

  const uniqueNodes = useMemo(() => {
    const nodes = Array.from(
      new Set(
        members.flatMap((m) => [
          JSON.stringify(m.startNode),
          JSON.stringify(m.endNode),
        ]),
      ),
    ).map((s) => JSON.parse(s) as { x: number; y: number });

    // Spatial sorting is critical for sequential support linking and logical ID generation
    return nodes.sort((a, b) => {
      if (a.x !== b.x) return a.x - b.x;
      return a.y - b.y;
    });
  }, [members]);

  const supportResolution = useMemo(() => {
    const supports: Record<string, { type: string; settlement: number }> = {};
    const conflicts: string[] = [];
    const tol = 1e-9;

    const register = (
      key: string,
      nodeLabel: string,
      type: string,
      settlement: number,
      memberIndex: number,
    ) => {
      const existing = supports[key];
      if (!existing) {
        supports[key] = { type, settlement };
        return;
      }
      if (
        existing.type !== type ||
        (!isFrameMode && Math.abs(existing.settlement - settlement) > tol)
      ) {
        conflicts.push(
          `${nodeLabel}: member ${memberIndex + 1} has ${type} (settlement=${settlement}), existing is ${existing.type} (settlement=${existing.settlement})`,
        );
      }
    };

    members.forEach((m, memberIndex) => {
      const sKey = JSON.stringify(m.startNode);
      const eKey = JSON.stringify(m.endNode);
      const sSettlement = isFrameMode
        ? 0
        : Number(m.supports.startSettlement || 0);
      const eSettlement = isFrameMode ? 0 : Number(m.supports.endSettlement || 0);

      if (m.supports.start !== "None") {
        register(
          sKey,
          `(${m.startNode.x}, ${m.startNode.y})`,
          m.supports.start,
          sSettlement,
          memberIndex,
        );
      }
      if (m.supports.end !== "None") {
        register(
          eKey,
          `(${m.endNode.x}, ${m.endNode.y})`,
          m.supports.end,
          eSettlement,
          memberIndex,
        );
      }
    });

    return { supports, conflicts };
  }, [members, isFrameMode]);

  const nodeSupports = supportResolution.supports;

  const jointActionResolution = useMemo(() => {
    const actions: Record<
      string,
      {
        fx: number;
        fy: number;
        mz: number;
      }
    > = {};

    const register = (
      key: string,
      joint: FrontJointAction | undefined,
    ) => {
      const j = joint || {};
      const fx = Number(j.fx ?? 0);
      const fy = Number(j.fy ?? 0);
      const mz = Number(j.mz ?? 0);

      if (!actions[key]) {
        actions[key] = { fx: 0, fy: 0, mz: 0 };
      }

      actions[key].fx += fx;
      actions[key].fy += fy;
      actions[key].mz += mz;
    };

    members.forEach((m) => {
      const sKey = JSON.stringify(m.startNode);
      const eKey = JSON.stringify(m.endNode);
      register(sKey, m.jointActions?.start);
      register(eKey, m.jointActions?.end);
    });

    return { actions };
  }, [members]);

  const toDisplayForce = (value: number) =>
    convertForce(value, "kN", resultUnits.force);
  const toDisplayMoment = (value: number) =>
    convertMoment(value, "kN*m", resultUnits.moment);
  const toDisplayLength = (value: number) =>
    convertLength(value, "m", resultUnits.length);

  const applyDefaultsToResultUnits = () => {
    setResultUnits({
      force: defaultUnits.force,
      length: defaultUnits.length,
      moment: defaultUnits.moment,
    });
  };

  const resolvePositiveOrDefault = (value: unknown, fallback: number) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
  };

  const resolveDesignAssumptions = (
    frontendMembers: Member[],
  ): DesignResults["assumptions"] => {
    const sourceParams = [...frontendMembers]
      .reverse()
      .find(
        (member) =>
          member.workflowMode === "design" &&
          member.designParams &&
          Object.values(member.designParams).some(
            (value) => Number.isFinite(Number(value)) && Number(value) > 0,
          ),
      )?.designParams;

    return {
      fcu: resolvePositiveOrDefault(sourceParams?.fcu, DESIGN_ASSUMPTIONS.fcu),
      fy: resolvePositiveOrDefault(sourceParams?.fy, DESIGN_ASSUMPTIONS.fy),
      concreteCover_mm: resolvePositiveOrDefault(
        sourceParams?.concreteCover_mm,
        DESIGN_ASSUMPTIONS.concreteCover_mm,
      ),
      linkDiameter_mm: resolvePositiveOrDefault(
        sourceParams?.linkDiameter_mm,
        DESIGN_ASSUMPTIONS.linkDiameter_mm,
      ),
      // Main bar diameter is kept as an internal default for effective-depth assumptions.
      mainBarDiameter_mm: DESIGN_ASSUMPTIONS.mainBarDiameter_mm,
      fyv: resolvePositiveOrDefault(sourceParams?.fyv, DESIGN_ASSUMPTIONS.fyv),
      linkBarDiameter_mm: DESIGN_ASSUMPTIONS.linkBarDiameter_mm,
      linkLegCount: DESIGN_ASSUMPTIONS.linkLegCount,
    };
  };

  const runDeflectionCheck = (
    spanLength_mm: number,
    d_mm: number,
    supportMoment: number,
  ): LimitCheckSummary => {
    if (!(spanLength_mm > 0) || !(d_mm > 0)) {
      return {
        status: "NA",
        message: "Insufficient geometry for deflection check.",
        actual: null,
        limit: null,
        units: "L/d",
      };
    }

    const isContinuous = supportMoment > 1e-6;
    const limit = isContinuous ? 26 : 20;
    const actual = spanLength_mm / d_mm;
    const status: LimitCheckSummary["status"] = actual <= limit ? "OK" : "CHECK";

    return {
      status,
      message:
        status === "OK"
          ? "Span/depth ratio is within basic BS 8110 deflection-control limit."
          : "Span/depth ratio exceeds basic BS 8110 limit. Review depth or stiffness.",
      actual,
      limit,
      units: "L/d",
      note:
        "Basic ratio check only; modification factors and long-term effects are not included.",
    };
  };

  const runCrackWidthCheck = (params: {
    beamWidth: number;
    cover: number;
    linkDiameter: number;
    spanBars: ProvidedBars | null;
    spanMoment: number;
    z: number | null;
  }): LimitCheckSummary => {
    const { beamWidth, cover, linkDiameter, spanBars, spanMoment, z } = params;
    if (!spanBars || !(beamWidth > 0) || !(z && z > 0)) {
      return {
        status: "NA",
        message: "Insufficient data for crack-width screening.",
        actual: null,
        limit: 0.3,
        units: "mm",
      };
    }

    const serviceMoment = Math.abs(spanMoment) / 1.5;
    if (serviceMoment <= 0) {
      return {
        status: "OK",
        message: "No service-level sagging moment; crack-width demand is negligible.",
        actual: 0,
        limit: 0.3,
        units: "mm",
      };
    }

    const nBars = spanBars.count;
    const phi = spanBars.diameter;
    const AsProv = spanBars.area;
    const effectiveCover = cover + linkDiameter + phi / 2;
    const clearSpacing =
      nBars > 1
        ? Math.max(
            0,
            (beamWidth - 2 * (cover + linkDiameter) - nBars * phi) / (nBars - 1),
          )
        : 0;
    const steelStress = (serviceMoment * 1e6) / (AsProv * z);
    const estimatedWk =
      3 * (effectiveCover + clearSpacing / 2) * (steelStress / 200000);
    const limit = 0.3;
    const status: LimitCheckSummary["status"] =
      estimatedWk <= limit ? "OK" : "CHECK";

    return {
      status,
      message:
        status === "OK"
          ? "Estimated crack width is within screening limit."
          : "Estimated crack width exceeds screening limit. Review steel/distribution.",
      actual: estimatedWk,
      limit,
      units: "mm",
      note:
        "Rapid screening estimate from service stress; detailed crack-width calc should confirm.",
    };
  };

  const pickProvidedBars = (requiredArea: number | null): ProvidedBars | null => {
    if (!Number.isFinite(requiredArea) || (requiredArea ?? 0) <= 0) return null;
    const barSizes = [12, 16, 20, 25, 32];
    const target = requiredArea ?? 0;

    for (const dia of barSizes) {
      const areaOne = (Math.PI * dia * dia) / 4;
      let count = Math.ceil(target / areaOne);
      if (count < 2) count = 2;
      if (count % 2 !== 0) count += 1;
      const area = count * areaOne;
      if (area >= target) {
        return {
          count,
          diameter: dia,
          area,
          label: `${count}Y${dia}`,
        };
      }
    }

    const fallbackDia = 32;
    const areaOne = (Math.PI * fallbackDia * fallbackDia) / 4;
    let count = Math.ceil(target / areaOne);
    if (count < 2) count = 2;
    if (count % 2 !== 0) count += 1;
    const area = count * areaOne;
    return {
      count,
      diameter: fallbackDia,
      area,
      label: `${count}Y${fallbackDia}`,
    };
  };

  const computeDesignResults = (
    frontendMembers: Member[],
    solverMembers: (Beam | Column | InclinedMember)[],
    endMoments: { span: string; left: number; right: number }[],
    assumptions: DesignResults["assumptions"],
  ): DesignResults => {
    const beams: BeamDesignSummary[] = [];
    const supports: SupportDesignSummary[] = [];
    const columns: ColumnDesignSummary[] = [];
    const rcc = new RCCDesignFormulaes(assumptions.fcu, assumptions.fy);
    const Asv =
      assumptions.linkLegCount *
      ((Math.PI * assumptions.linkBarDiameter_mm ** 2) / 4);
    const supportCollectors = new Map<
      string,
      {
        supportLabel: string;
        connectedMembers: Set<string>;
        governingMoment: number;
        beamWidth: number;
        overallDepth: number;
      }
    >();

    const collectSupportDemand = (
      supportLabel: string,
      moment: number,
      memberLabel: string,
      beamWidth: number,
      overallDepth: number,
    ) => {
      const hoggingMoment = Math.max(0, moment);
      const existing = supportCollectors.get(supportLabel);
      if (!existing) {
        supportCollectors.set(supportLabel, {
          supportLabel,
          connectedMembers: new Set([memberLabel]),
          governingMoment: hoggingMoment,
          beamWidth,
          overallDepth,
        });
        return;
      }

      existing.connectedMembers.add(memberLabel);
      if (hoggingMoment > existing.governingMoment) {
        existing.governingMoment = hoggingMoment;
        existing.beamWidth = beamWidth;
        existing.overallDepth = overallDepth;
      }
    };

    frontendMembers.forEach((frontend, index) => {
      if (frontend.workflowMode !== "design") return;

      const solverMember = solverMembers[index];
      const memberLabel = `M${index + 1}`;

      if (solverMember instanceof Beam) {
        const b_mm = Number(frontend.b ?? 0) * 1000;
        const h_mm = Number(frontend.h ?? 0) * 1000;
        if (!(b_mm > 0 && h_mm > 0)) {
          beams.push({
            memberLabel,
            status: "ERROR",
            message: "Beam design mode requires valid section width/depth.",
            supportMoment: null,
            spanMoment: null,
            flexure: null,
            supportBars: null,
            spanBars: null,
            shearZones: [],
            deflectionCheck: {
              status: "NA",
              message: "Deflection check unavailable due to invalid beam section input.",
              actual: null,
              limit: null,
              units: "L/d",
            },
            crackWidthCheck: {
              status: "NA",
              message: "Crack-width check unavailable due to invalid beam section input.",
              actual: null,
              limit: null,
              units: "mm",
            },
          });
          return;
        }

        const solved = endMoments[index];
        if (!solved) {
          beams.push({
            memberLabel,
            status: "ERROR",
            message: "No solved moments found for this beam.",
            supportMoment: null,
            spanMoment: null,
            flexure: null,
            supportBars: null,
            spanBars: null,
            shearZones: [],
            deflectionCheck: {
              status: "NA",
              message: "Deflection check unavailable because solved moments are missing.",
              actual: null,
              limit: null,
              units: "L/d",
            },
            crackWidthCheck: {
              status: "NA",
              message: "Crack-width check unavailable because solved moments are missing.",
              actual: null,
              limit: null,
              units: "mm",
            },
          });
          return;
        }

        collectSupportDemand(
          solverMember.startNode.id,
          Math.abs(solved.left),
          memberLabel,
          b_mm,
          h_mm,
        );
        collectSupportDemand(
          solverMember.endNode.id,
          Math.abs(solved.right),
          memberLabel,
          b_mm,
          h_mm,
        );

        const sectionType: SpanSectionType =
          frontend.beamSectionType === "L" || frontend.beamSectionType === "T"
            ? frontend.beamSectionType
            : "Rectangular";

        const diagram = calculateDiagramData(frontend, {
          leftMoment: solved.left,
          rightMoment: solved.right,
        });
        const moments = diagram.map((p) => p.moment);
        const supportMoment = moments.length
          ? Math.max(0, -Math.min(...moments))
          : 0;
        const spanMoment = moments.length ? Math.max(0, ...moments) : 0;

        try {
          const flexure = rcc.designBeamByZones({
            supportMoment,
            spanMoment,
            spanSectionType: sectionType,
            beamWidth: b_mm,
            overallDepth: h_mm,
            concreteCover: assumptions.concreteCover_mm,
            linkDiameter: assumptions.linkDiameter_mm,
            mainBarDiameter: assumptions.mainBarDiameter_mm,
            continuousSpanLength:
              sectionType === "L" || sectionType === "T"
                ? solverMember.length * 1000
                : undefined,
          });

          const supportReq = Math.max(flexure.topSteelRequired ?? 0, flexure.AsMin);
          const spanReq = Math.max(flexure.bottomSteelRequired ?? 0, flexure.AsMin);
          const supportBars = pickProvidedBars(supportReq);
          const spanBars = pickProvidedBars(spanReq);

          const shearZonesLocal = rcc.designShearZonesFromInternalForces(
            diagram.map((p) => ({ x: p.x, shear: p.shear })),
            {
              b: b_mm,
              d: flexure.d,
              As: Math.max(supportReq, spanReq),
              fcu: assumptions.fcu,
              fyv: assumptions.fyv,
              Asv,
            },
          );
          const memberLength = solverMember.length || 1;
          const mapLocalXToGlobal = (localX: number) => {
            const clamped = Math.max(0, Math.min(localX, memberLength));
            const ratio = memberLength > 0 ? clamped / memberLength : 0;
            return (
              frontend.startNode.x +
              (frontend.endNode.x - frontend.startNode.x) * ratio
            );
          };
          const shearZones = shearZonesLocal.map((zone) => {
            const gx1 = mapLocalXToGlobal(zone.startX);
            const gx2 = mapLocalXToGlobal(zone.endX);
            const startX = Math.min(gx1, gx2);
            const endX = Math.max(gx1, gx2);
            const instruction =
              zone.status === "FAIL"
                ? `From x = ${startX.toFixed(2)}m to x = ${endX.toFixed(2)}m: SECTION FAILS SHEAR. Increase b or d.`
                : `From x = ${startX.toFixed(2)}m to x = ${endX.toFixed(2)}m, provide 2-legs at ${zone.providedSpacing}mm c/c stirrups.`;
            return { ...zone, startX, endX, instruction };
          });

          const deflectionCheck = runDeflectionCheck(
            solverMember.length * 1000,
            flexure.d,
            supportMoment,
          );
          const crackWidthCheck = runCrackWidthCheck({
            beamWidth: b_mm,
            cover: assumptions.concreteCover_mm,
            linkDiameter: assumptions.linkDiameter_mm,
            spanBars,
            spanMoment,
            z: flexure.span.z,
          });

          const status =
            flexure.ok &&
            shearZones.every((z) => z.status === "OK") &&
            deflectionCheck.status !== "CHECK" &&
            crackWidthCheck.status !== "CHECK"
              ? "OK"
              : "CHECK";
          const message =
            !flexure.ok && flexure.messages.length
              ? flexure.messages.join(" | ")
              : shearZones.some((z) => z.status !== "OK")
                ? "Flexure solved. Review shear warnings/fail regions."
                : deflectionCheck.status === "CHECK"
                  ? "Flexure/shear solved. Deflection check requires review."
                  : crackWidthCheck.status === "CHECK"
                    ? "Flexure/shear solved. Crack-width check requires review."
                : "Flexure and shear design checks completed.";

          beams.push({
            memberLabel,
            status,
            message,
            supportMoment,
            spanMoment,
            flexure,
            supportBars,
            spanBars,
            shearZones,
            deflectionCheck,
            crackWidthCheck,
          });
        } catch (error: any) {
          beams.push({
            memberLabel,
            status: "ERROR",
            message: error?.message || "Beam design calculation failed.",
            supportMoment,
            spanMoment,
            flexure: null,
            supportBars: null,
            spanBars: null,
            shearZones: [],
            deflectionCheck: {
              status: "NA",
              message: "Deflection check unavailable because beam flexural design failed.",
              actual: null,
              limit: null,
              units: "L/d",
            },
            crackWidthCheck: {
              status: "NA",
              message: "Crack-width check unavailable because beam flexural design failed.",
              actual: null,
              limit: null,
              units: "mm",
            },
          });
        }
        return;
      }

      if (isFrameMode && solverMember instanceof Column) {
        const b_mm = Number(frontend.b ?? 0) * 1000;
        const h_mm = Number(frontend.h ?? 0) * 1000;
        if (!(b_mm > 0 && h_mm > 0)) {
          columns.push({
            memberLabel,
            status: "SKIPPED",
            message: "Column design mode requires valid section width/depth.",
            axialLoadUsed: null,
            result: null,
          });
          return;
        }

        const axialLoadUsed = Math.max(
          Math.abs(solverMember.endReactions.RyStart || 0),
          Math.abs(solverMember.endReactions.RyEnd || 0),
        );

        const result = designShortBracedColumn({
          load_kN: axialLoadUsed,
          width_mm: b_mm,
          depth_mm: h_mm,
          clearHeight_mm: solverMember.length * 1000,
          fcu: assumptions.fcu,
          fy: assumptions.fy,
        });

        columns.push({
          memberLabel,
          status: result.status,
          message: result.message,
          axialLoadUsed,
          result,
        });
        return;
      }

      columns.push({
        memberLabel,
        status: "SKIPPED",
        message: "Only beam/column members are included in this design view.",
        axialLoadUsed: null,
        result: null,
      });
    });

    supportCollectors.forEach((collector) => {
      try {
        const supportFlexure = rcc.designBeamByZones({
          supportMoment: collector.governingMoment,
          spanMoment: 0,
          spanSectionType: "Rectangular",
          beamWidth: collector.beamWidth,
          overallDepth: collector.overallDepth,
          concreteCover: assumptions.concreteCover_mm,
          linkDiameter: assumptions.linkDiameter_mm,
          mainBarDiameter: assumptions.mainBarDiameter_mm,
        });

        const AsRequired = Math.max(
          supportFlexure.topSteelRequired ?? 0,
          supportFlexure.AsMin,
        );
        const AsProvided = pickProvidedBars(AsRequired);
        const status: SupportDesignSummary["status"] = supportFlexure.support.ok
          ? "OK"
          : "CHECK";
        const message =
          collector.governingMoment > 0
            ? supportFlexure.support.message ||
              "Support flexural design/check completed."
            : "No support end moment detected. Minimum steel governs.";

        supports.push({
          supportLabel: collector.supportLabel,
          status,
          message,
          governingMoment: collector.governingMoment,
          connectedMembers: Array.from(collector.connectedMembers),
          d: supportFlexure.d,
          AsMin: supportFlexure.AsMin,
          AsMax: supportFlexure.AsMax,
          K: supportFlexure.support.K,
          z: supportFlexure.support.z,
          x: supportFlexure.support.x,
          AsRequired,
          AsProvided,
        });
      } catch (error: any) {
        supports.push({
          supportLabel: collector.supportLabel,
          status: "ERROR",
          message: error?.message || "Support design calculation failed.",
          governingMoment: collector.governingMoment,
          connectedMembers: Array.from(collector.connectedMembers),
          d: null,
          AsMin: null,
          AsMax: null,
          K: null,
          z: null,
          x: null,
          AsRequired: null,
          AsProvided: null,
        });
      }
    });

    supports.sort((a, b) => {
      const aNum = Number((a.supportLabel.match(/\d+/) || [""])[0]);
      const bNum = Number((b.supportLabel.match(/\d+/) || [""])[0]);
      if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
        return aNum - bNum;
      }
      return a.supportLabel.localeCompare(b.supportLabel);
    });

    return {
      assumptions,
      checks: DESIGN_CHECK_COVERAGE,
      beams,
      supports,
      columns,
    };
  };

  const formattedSolveData = (() => {
    if (!solveResults) return solveData;

    let reportText = `Result Units:\n`;
    reportText += `  Force: ${resultUnits.force}\n`;
    reportText += `  Moment: ${resultUnits.moment}\n`;
    reportText += `  Length: ${resultUnits.length}\n\n`;
    if (solveResults.frameSidesway !== null) {
      reportText += `  Frame Sidesway: ${solveResults.frameSidesway ? "Present" : "Absent"}\n\n`;
    }

    reportText += "The Fixed End Moments for the model is given below:\n";
    solveResults.fems.forEach((f) => {
      reportText += `Member ${f.span}:\n`;
      reportText += `     FEM Start: ${toDisplayMoment(f.start).toFixed(2)} ${resultUnits.moment}\n`;
      reportText += `     FEM End: ${toDisplayMoment(f.end).toFixed(2)} ${resultUnits.moment}\n`;
    });

    reportText += "\nThe End Moments of each span are given below:\n";
    solveResults.endMoments.forEach((m) => {
      reportText += `${m.span}:\n`;
      reportText += `     Left Moment: ${toDisplayMoment(m.left).toFixed(2)} ${resultUnits.moment}\n`;
      reportText += `     Right Moment: ${toDisplayMoment(m.right).toFixed(2)} ${resultUnits.moment}\n`;
    });

    reportText += "\nThe Support Reactions are Given Below:\n";
    solveResults.reactions.forEach((r) => {
      reportText += `${r.id}:\n`;
      if (r.x !== undefined) {
        reportText += `     X-reaction: ${toDisplayForce(r.x).toFixed(2)} ${resultUnits.force}\n`;
      }
      reportText += `     Y-reaction: ${toDisplayForce(r.y).toFixed(2)} ${resultUnits.force}\n`;
      if (r.m !== undefined) {
        reportText += `     M-reaction: ${toDisplayMoment(r.m).toFixed(2)} ${resultUnits.moment}\n`;
      }
    });

    if (
      solveResults.design.beams.length ||
      solveResults.design.supports.length ||
      solveResults.design.columns.length
    ) {
      const a = solveResults.design.assumptions;
      reportText += "\nDesign Mode Results (BS 8110 workflow):\n";
      reportText += `  Assumptions: fcu=${a.fcu}N/mm^2, fy=${a.fy}N/mm^2, cover=${a.concreteCover_mm}mm, links=${a.linkDiameter_mm}mm\n`;
      reportText += "  Checks Coverage:\n";
      solveResults.design.checks.forEach((check) => {
        reportText += `     - ${check.name}: ${check.status} (${check.notes})\n`;
      });

      solveResults.design.beams.forEach((beam) => {
        reportText += `  ${beam.memberLabel} Beam [${beam.status}]\n`;
        reportText += `     ${beam.message}\n`;
        if (beam.flexure) {
          reportText += `     d=${beam.flexure.d.toFixed(2)} mm, As,min=${beam.flexure.AsMin.toFixed(2)} mm^2, As,max=${beam.flexure.AsMax.toFixed(2)} mm^2\n`;
          reportText += `     Support: K=${beam.flexure.support.K?.toFixed(4) ?? "-"}, z=${beam.flexure.support.z?.toFixed(2) ?? "-"} mm, As(req)=${beam.flexure.topSteelRequired?.toFixed(2) ?? "-"} mm^2, As(prov)=${beam.supportBars ? `${beam.supportBars.area.toFixed(2)} mm^2 (${beam.supportBars.label})` : "-"}\n`;
          reportText += `     Span: K=${beam.flexure.span.K?.toFixed(4) ?? "-"}, z=${beam.flexure.span.z?.toFixed(2) ?? "-"} mm, As(req)=${beam.flexure.bottomSteelRequired?.toFixed(2) ?? "-"} mm^2, As(prov)=${beam.spanBars ? `${beam.spanBars.area.toFixed(2)} mm^2 (${beam.spanBars.label})` : "-"}\n`;
        }
        reportText += `     Deflection: ${beam.deflectionCheck.status} (${beam.deflectionCheck.actual !== null ? `${beam.deflectionCheck.actual.toFixed(2)} ${beam.deflectionCheck.units}` : "-"}/${beam.deflectionCheck.limit !== null ? `${beam.deflectionCheck.limit.toFixed(2)} ${beam.deflectionCheck.units}` : "-"})\n`;
        reportText += `     Crack Width: ${beam.crackWidthCheck.status} (${beam.crackWidthCheck.actual !== null ? `${beam.crackWidthCheck.actual.toFixed(3)} ${beam.crackWidthCheck.units}` : "-"}/${beam.crackWidthCheck.limit !== null ? `${beam.crackWidthCheck.limit.toFixed(3)} ${beam.crackWidthCheck.units}` : "-"})\n`;
        beam.shearZones.forEach((zone) => {
          reportText += `     Shear zone x=${zone.startX.toFixed(2)}m to ${zone.endX.toFixed(2)}m: ${zone.status}\n`;
        });
      });

      solveResults.design.supports.forEach((support) => {
        reportText += `  Support ${support.supportLabel} [${support.status}]\n`;
        reportText += `     ${support.message}\n`;
        reportText += `     Connected spans: ${support.connectedMembers.join(", ")}\n`;
        reportText += `     Governing support end moment: ${support.governingMoment?.toFixed(2) ?? "-"} kNm\n`;
      });

      solveResults.design.columns.forEach((col) => {
        reportText += `  ${col.memberLabel} Column [${col.status}]\n`;
        reportText += `     ${col.message}\n`;
        if (col.axialLoadUsed !== null) {
          reportText += `     Axial load used: ${col.axialLoadUsed.toFixed(2)} kN\n`;
        }
      });
    }

    return reportText;
  })();

  const handleSolve = () => {
    try {
      if (supportResolution.conflicts.length) {
        throw new Error(
          `Conflicting support assignments detected:\n${supportResolution.conflicts.join("\n")}`,
        );
      }
      if (
        isFrameMode &&
        members.some((m) => (m.memberType || "Beam") === "Inclined")
      ) {
        throw new Error(
          "Inclined members are currently unsupported in frame mode. Use Beam/Column only.",
        );
      }

      // 1. Map frontend nodes to SolverNode instances
      const solverNodesMap = new Map<string, SolverNode>();
      let lastSupport: SolverSupport | null = null;

      uniqueNodes.forEach((n, idx) => {
        const nKey = JSON.stringify(n);
        const supportData = nodeSupports[nKey];
        const supportType = supportData?.type || "None";
        const settlement = isFrameMode ? 0 : supportData?.settlement || 0;

        let support: SolverSupport | null = null;
        if (supportType === "Fixed") {
          support = new FixedSupport(n.x, n.y, lastSupport, settlement);
          lastSupport = support;
        } else if (supportType === "Pinned") {
          support = new PinnedSupport(n.x, n.y, lastSupport, settlement);
          lastSupport = support;
        } else if (supportType === "Roller") {
          support = new RollerSupport(n.x, n.y, lastSupport, settlement);
          lastSupport = support;
        }

        const solverNode = new SolverNode(
          `N${idx + 1}`,
          n.x,
          n.y,
          support as any,
        );

        const nodeJointAction = jointActionResolution.actions[nKey];
        if (nodeJointAction) {
          if (nodeJointAction.fx || nodeJointAction.fy) {
            // Global nodal loads: +Fx right, +Fy upward.
            solverNode.addNodalLoad(nodeJointAction.fx, nodeJointAction.fy);
          }
          if (nodeJointAction.mz) {
            // Positive nodal moment is anti-clockwise.
            solverNode.addMomentLoad(nodeJointAction.mz);
          }
        }
        solverNodesMap.set(nKey, solverNode);
      });

      // 2. Map frontend members to Beam/Column/InclinedMember instances and add loads
      const solverMembers: (Beam | Column | InclinedMember)[] = members.map(
        (m) => {
          const startSolverNode = solverNodesMap.get(
            JSON.stringify(m.startNode),
          )!;
          const endSolverNode = solverNodesMap.get(JSON.stringify(m.endNode))!;

          const type = m.memberType || (isFrameMode ? "Column" : "Beam");
          const useDesignGeometry = m.workflowMode === "design";
          const memberB = useDesignGeometry ? Number(m.b ?? 0) : 0;
          const memberH = useDesignGeometry ? Number(m.h ?? 0) : 0;
          const slabThickness = useDesignGeometry
            ? Number(m.slabThickness ?? 0)
            : 0;
          const memberE = Number(m.Ecoef ?? 1);
          const memberI = Number(m.Icoef ?? 1);
          let member: Beam | Column | InclinedMember;

          if (type === "Column") {
            // Column(start, end, b, h, E, I)
            member = new Column(
              startSolverNode,
              endSolverNode,
              memberB,
              memberH,
              memberE,
              memberI,
            );
          } else if (type === "Beam") {
            const beamSectionType =
              m.beamSectionType === "L" || m.beamSectionType === "T"
                ? m.beamSectionType
                : null;
            // Beam(start, end, b, h, type=null, E, I, slabThickness)
            member = new Beam(
              startSolverNode,
              endSolverNode,
              memberB,
              memberH,
              beamSectionType,
              memberE,
              memberI,
              slabThickness,
            );
          } else {
            // Inclined(start, end, b, h, E, I)
            member = new InclinedMember(
              startSolverNode,
              endSolverNode,
              memberB,
              memberH,
              memberE,
              memberI,
            );
          }

          const memberAngle = Math.atan2(
            endSolverNode.y - startSolverNode.y,
            endSolverNode.x - startSolverNode.x,
          );
          const toGlobalComponents = (
            magnitude: number,
            angleDeg: number | undefined,
          ) => {
            const angleRad = ((angleDeg ?? 90) * Math.PI) / 180;
            const fx = magnitude * Math.cos(angleRad);
            // Upward force is positive in global coordinates.
            // UI angle uses screen convention where +90deg points downward.
            const fy = -magnitude * Math.sin(angleRad);
            return { fx, fy };
          };

          const toLocalComponents = (
            magnitude: number,
            angleDeg: number | undefined,
          ) => {
            const { fx, fy } = toGlobalComponents(magnitude, angleDeg);
            const transverse =
              fx * Math.sin(memberAngle) - fy * Math.cos(memberAngle);
            const axial =
              fx * Math.cos(memberAngle) + fy * Math.sin(memberAngle);
            return { transverse, axial };
          };

          const distributeAxialEquivalentToNodes = (
            axialResultant: number,
            localPositionFromStart: number,
          ) => {
            if (Math.abs(axialResultant) < 1e-12) return;

            const L = member.length || 1;
            const position = Math.max(0, Math.min(localPositionFromStart, L));

            const startShare = axialResultant * (1 - position / L);
            const endShare = axialResultant * (position / L);

            const startFx = startShare * Math.cos(memberAngle);
            const startFy = startShare * Math.sin(memberAngle);
            const endFx = endShare * Math.cos(memberAngle);
            const endFy = endShare * Math.sin(memberAngle);

            // External nodal loads: +Fx right, +Fy upward.
            startSolverNode.addNodalLoad(startFx, startFy);
            endSolverNode.addNodalLoad(endFx, endFy);
          };

          // Add loads
          m.loads.forEach((l) => {
            if (l.type === "Point") {
              const magnitude = Number(l.value || 0);
              const local = toLocalComponents(magnitude, l.angle);
              const position = Number(l.position || 0);
              member.addLoad(new SolverPointLoad(position, local.transverse));
              distributeAxialEquivalentToNodes(local.axial, position);
            } else if (l.type === "UDL") {
              const magnitudePerLength = Number(l.value || 0);
              const local = toLocalComponents(magnitudePerLength, l.angle);
              const startPosition = Number(l.position || 0);
              const span = Number(l.span || 0);
              // Correct mapping: l.span is already the length of the UDL
              member.addLoad(
                new SolverUDL(startPosition, span, local.transverse),
              );
              distributeAxialEquivalentToNodes(
                local.axial * span,
                startPosition + span / 2,
              );
            } else if (l.type === "VDL") {
              const highMagnitude = Number(l.highValue ?? l.value ?? 0);
              const local = toLocalComponents(highMagnitude, l.angle);
              const highPosition = Number(l.highPosition || 0);
              const lowPosition = Number(l.lowPosition || 0);
              member.addLoad(
                new SolverVDL(local.transverse, highPosition, 0, lowPosition),
              );

              const span = Math.abs(highPosition - lowPosition);
              const axialResultant = (local.axial * span) / 2;
              const resultantPos =
                lowPosition + (2 / 3) * (highPosition - lowPosition);
              distributeAxialEquivalentToNodes(axialResultant, resultantPos);
            }
          });

          return member;
        },
      );

      // 3. Execute Solver
      let resultsData: any = {};
      let frameSidesway: boolean | null = null;
      let beamDiagrams: BeamMemberDiagram[] = [];
      if (isFrameMode) {
        const solver = new FrameSolver(solverMembers as any);
        frameSidesway = solver.isSideSway();
        resultsData = {
          moments: solver.updatedGetFinalMoments(),
          reactions: Object.fromEntries(solver.updatedSolveReactions()),
        };
      } else {
        const solver = new BeamSolver(solverMembers as Beam[]);
        resultsData = {
          moments: solver.updatedGetFinalMoments(),
          reactions: solver.updatedGetSupportReactions(),
        };
        beamDiagrams = solver
          .getAllBeamInternalForceData(0.05)
          .map((entry, index) => ({
            span: `Span ${index + 1}`,
            data: entry.data,
          }));
      }

      // 4. Generate Formatted Report
      const femSolver = new FixedEndMoments();
      let reportText = "The Fixed End Moments for the model is given below:\n";
      const fems: { span: string; start: number; end: number }[] = [];
      const endMoments: { span: string; left: number; right: number }[] = [];
      const reactions: SolveReaction[] = [];

      if (frameSidesway !== null) {
        reportText += frameSidesway
          ? "\nFrame Sidesway Status: SWAY PRESENT\n\n"
          : "\nFrame Sidesway Status: NO SWAY (BRACED)\n\n";
      }

      solverMembers.forEach((m, i) => {
        const spanId = `M${i + 1}`;
        const femStart = femSolver.getFixedEndMoment(m, "start") || 0;
        const femEnd = femSolver.getFixedEndMoment(m, "end") || 0;

        fems.push({ span: spanId, start: femStart, end: femEnd });

        reportText += `Member ${spanId} (N${m.startNode.id} to N${m.endNode.id}):\n`;
        reportText += `     FEM Start: ${femStart.toFixed(2)}\n`;
        reportText += `     FEM End: ${femEnd.toFixed(2)}\n`;
      });

      reportText += "\nthe End Moments of each span is given below:\n";
      if (isFrameMode) {
        const moments = resultsData.moments as Record<string, number>;
        solverMembers.forEach((m, i) => {
          const m1 = moments[`MOMENT${m.startNode.id}${m.endNode.id}`] || 0;
          const m2 = moments[`MOMENT${m.endNode.id}${m.startNode.id}`] || 0;

          endMoments.push({ span: `Member ${i + 1}`, left: m1, right: m2 });

          reportText += `Member ${i + 1}:\n`;
          reportText += `     Left Moment: ${m1.toFixed(2)}\n`;
          reportText += `     Right Moment: ${m2.toFixed(2)}\n`;
        });
      } else {
        const moments = resultsData.moments as {
          nodeId: string;
          leftMoment: number;
          rightMoment: number;
        }[];
        const momentsByNode = new Map(moments.map((m) => [m.nodeId, m]));
        solverMembers.forEach((m, i) => {
          const startNodeMoments = momentsByNode.get(m.startNode.id);
          const endNodeMoments = momentsByNode.get(m.endNode.id);

          // Slope-deflection convention used here:
          // anti-clockwise moment is positive.
          const m1 = startNodeMoments?.rightMoment || 0;
          const m2 = endNodeMoments?.leftMoment || 0;

          endMoments.push({ span: `Span ${i + 1}`, left: m1, right: m2 });

          reportText += `Span ${i + 1}:\n`;
          reportText += `     Start Moment (M_SD): ${m1.toFixed(2)}\n`;
          reportText += `     End Moment (M_SD): ${m2.toFixed(2)}\n`;
        });
      }

      reportText += "\nThe Support Reactions are Given Below:\n";
      Object.entries(resultsData.reactions as Record<string, any>).forEach(
        ([id, r]) => {
          let x: number | undefined = undefined;
          let y: number = 0;
          let m: number | undefined = undefined;

          if (r && typeof r === "object") {
            const hasX = r.xReaction !== undefined;
            const hasY = r.yReaction !== undefined;
            const hasM = r.momentReaction !== undefined;

            const xVal = hasX ? Number(r.xReaction) || 0 : undefined;
            const yVal = hasY ? Number(r.yReaction) || 0 : 0;
            const mVal = hasM ? Number(r.momentReaction) || 0 : undefined;

            x = xVal;
            y = yVal;
            m = mVal;

            reportText += `${id}:\n`;
            if (xVal !== undefined) {
              reportText += `     X-reaction: ${xVal.toFixed(2)}\n`;
            }
            reportText += `     Y-reaction: ${yVal.toFixed(2)}\n`;
            if (mVal !== undefined) {
              reportText += `     M-reaction: ${mVal.toFixed(2)}\n`;
            }
          }

          reactions.push({ id, x, y, m });
        },
      );

      const activeDesignAssumptions = resolveDesignAssumptions(members);
      const design = computeDesignResults(
        members,
        solverMembers,
        endMoments,
        activeDesignAssumptions,
      );

      setSolveResults({
        fems,
        endMoments,
        reactions,
        frameSidesway,
        beamDiagrams,
        design,
      });
      setSolveData(reportText);
      setActiveModal("solve");
    } catch (error: any) {
      console.error("Solver Error:", error);
      alert(`Analysis failed: ${error.message}`);
    }
  };

  const handleDownloadReport = () => {
    const blob = new Blob([formattedSolveData], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "structural_report.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#050505] text-white">
      {/* Premium Navigation Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 glassy-panel z-50">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-[var(--primary)] rounded-lg flex items-center justify-center transform group-hover:rotate-12 transition-transform shadow-lg shadow-[var(--primary-glow)]">
              <span className="font-bold text-lg">S</span>
            </div>
            <span className="text-xl font-bold tracking-tight gradient-text">
              Structuro Studio
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-gray-500">
            <span className="px-3 py-1 bg-white/5 rounded text-gray-300">
              {isFrameMode ? "Frame Analysis" : "Beam Analysis"}
            </span>
            <span className="text-xs">/</span>
            <span className="px-3 py-1 hover:text-white transition-colors cursor-pointer capitalize">
              {mode} Workspace
            </span>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/settings"
            className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-300 transition-colors hover:text-white hover:bg-white/10"
          >
            Settings
          </Link>

          <button
            onClick={handleSolve}
            className="bg-white text-black px-6 py-2 rounded-full text-sm font-bold hover:bg-gray-200 transition-all shadow-xl shadow-white/5 transform hover:scale-105 active:scale-95"
          >
            Solve Structure
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar for members and actions */}
        <aside
          className={`${isSidebarOpen ? "w-80" : "w-0"} transition-all duration-300 border-r border-white/5 glassy-panel h-full flex flex-col z-40 overflow-hidden`}
        >
          <div className="p-5 flex items-center justify-between border-b border-white/10 bg-white/5">
            <h2 className="font-semibold text-gray-300 uppercase tracking-widest text-[10px]">
              Structural Members
            </h2>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-500 hover:text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m11 17-5-5 5-5" />
                <path d="m18 17-5-5 5-5" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0a0a]/50">
            {members.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl px-8 text-center bg-white/[0.02]">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 text-gray-600">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 12V20" />
                    <path d="M20 12V20" />
                    <path d="M2 12H22" />
                    <path d="M12 2V12" />
                  </svg>
                </div>
                <p className="text-gray-500 text-xs leading-relaxed">
                  No structural data found. Click "Define Member" to populate
                  the engine.
                </p>
              </div>
            ) : (
              members.map((m, i) => (
                <div
                  key={i}
                  className="group relative bg-white/[0.03] border border-white/5 hover:border-[var(--primary)] p-4 rounded-xl transition-all duration-300 hover:bg-white/[0.05] glow-hover"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-black text-[var(--primary)] uppercase tracking-widest">
                      Component M{i + 1}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(i)}
                        className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() =>
                          setMembers(members.filter((_, idx) => idx !== i))
                        }
                        className="p-1 rounded hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-black tracking-tight mb-0.5">
                          N{i + 1} ➔ N{i + 2}
                        </span>
                        <span className="text-[9px] font-black bg-white/10 px-1.5 py-0.5 rounded text-gray-400 border border-white/5 w-fit lowercase italic">
                          {m.memberType || "Beam"}
                        </span>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-gray-600 text-[8px] uppercase font-black mb-0.5">
                          Total Vector Mass
                        </span>
                        <span className="text-gray-200 text-[10px] font-bold">
                          {m.loads.length} Loads
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/5">
                      <span className="text-gray-600 text-[8px] uppercase font-black block mb-1 tracking-widest">
                        Global Matrix POS
                      </span>
                      <div className="flex justify-between text-[10px] font-bold tracking-tighter text-gray-400">
                        <span>
                          {isFrameMode
                            ? `(${m.startNode.x}, ${m.startNode.y})`
                            : `${m.startNode.x}m`}
                        </span>
                        <span className="text-gray-700 mx-1">→</span>
                        <span>
                          {isFrameMode
                            ? `(${m.endNode.x}, ${m.endNode.y})`
                            : `${m.endNode.x}m`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-5 border-t border-white/10 bg-black/40 backdrop-blur-md">
            <button
              onClick={() => {
                setEditingIndex(null);
                setActiveModal("member");
              }}
              className="w-full bg-[var(--primary)] text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-2xl shadow-[var(--primary-glow)] flex items-center justify-center gap-3 hover:translate-y-[-2px] active:translate-y-[1px]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              Define Member
            </button>
          </div>
        </aside>

        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-6 top-1/2 -translate-y-1/2 z-50 p-3 glassy-panel rounded-full hover:bg-white/10 transition-all duration-300 shadow-2xl"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m13 17 5-5-5-5" />
              <path d="m6 17 5-5-5-5" />
            </svg>
          </button>
        )}

        {/* Main Canvas Workspace */}
        <main className="flex-1 relative bg-[#050505] overflow-hidden group/canvas">
          {/* Legend */}
          <div className="pointer-events-none absolute right-4 top-4 z-30 glassy-panel rounded-2xl border border-white/5 px-3 py-2">
            <div className="flex flex-col gap-1.5 text-[9px] font-black uppercase tracking-widest text-gray-500">
              <span className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] shadow-[0_0_8px_var(--primary-glow)]"></div>
                Active Node
              </span>
              <span className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)]"></div>
                Vector Force
              </span>
              <span className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--support)] shadow-[0_0_8px_var(--accent-glow)]"></div>
                Support Element
              </span>
            </div>
          </div>

          <StructurePreview members={members} />

          {members.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none animate-in fade-in zoom-in duration-1000">
              <div className="w-32 h-32 rounded-[2.5rem] glassy-panel flex items-center justify-center mb-10 border-white/10 shadow-3xl bg-white/[0.01]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white/10"
                >
                  <path d="M22 12H2" />
                  <path d="M5 12v4" />
                  <path d="M19 12v4" />
                  <path d="M12 12V8" />
                </svg>
              </div>
              <h3 className="text-4xl font-black text-gray-200 tracking-tighter mb-4">
                SOLVER ENGINE
              </h3>
              <p className="text-gray-500 max-w-sm text-center text-sm font-medium leading-relaxed px-12">
                Initialize the engine by defining your first beam member and
                node coordinates.
              </p>
            </div>
          )}

          {/* Precision HUD (Bottom) */}
          <div className="absolute bottom-8 left-10 right-10 flex justify-between items-end">
            <div className="flex flex-col gap-4">
              <div className="glassy-panel px-5 py-3 rounded-2xl flex gap-10 items-center animate-in slide-in-from-bottom-5 duration-700 shadow-2xl">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    Nodes
                  </span>
                  <span className="text-xl font-bold tabular-nums">
                    {uniqueNodes.length.toString().padStart(2, "0")}
                  </span>
                </div>
                <div className="w-px h-8 bg-white/10"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    Span
                  </span>
                  <span className="text-xl font-bold tabular-nums">
                    {toDisplayLength(
                      members.reduce(
                        (acc, m) => acc + (m.endNode.x - m.startNode.x),
                        0,
                      ),
                    ).toFixed(2)}
                    {resultUnits.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <Modal isOpen={activeModal === "member"} onClose={closeModal}>
        <MemberForm
          mode={isFrameMode ? "frames" : "beams"}
          onSuccess={handleCreateMember}
          initialStartNode={suggestedStart}
          existingNodes={uniqueNodes}
          nodeSupports={nodeSupports as any}
          defaultUnits={defaultUnits}
          initialData={
            editingIndex !== null ? members[editingIndex] : undefined
          }
        />
      </Modal>

      <Modal
        isOpen={activeModal === "solve"}
        onClose={() => setActiveModal("none")}
      >
        <div className="p-8 w-full">
          <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tighter text-white">
                Analysis Kernel Model
              </h2>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">
                Detailed Structural Schema Export
              </p>
              {solveResults?.frameSidesway !== null && (
                <p
                  className={`mt-2 inline-flex rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${
                    solveResults?.frameSidesway
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  }`}
                >
                  {solveResults?.frameSidesway
                    ? "Sidesway Present"
                    : "No Sidesway (Braced)"}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white/[0.02] border border-white/10 rounded-xl p-2">
                <div className="min-w-[110px]">
                  <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-gray-500">
                    Force
                  </label>
                  <select
                    value={resultUnits.force}
                    onChange={(e) =>
                      setResultUnits((prev) => ({
                        ...prev,
                        force: e.target.value as ForceUnit,
                      }))
                    }
                    className="w-full bg-black border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase text-gray-300 outline-none"
                  >
                    {(["kN", "N", "lb", "kip"] as ForceUnit[]).map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[110px]">
                  <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-gray-500">
                    Moment
                  </label>
                  <select
                    value={resultUnits.moment}
                    onChange={(e) =>
                      setResultUnits((prev) => ({
                        ...prev,
                        moment: e.target.value as MomentUnit,
                      }))
                    }
                    className="w-full bg-black border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase text-gray-300 outline-none"
                  >
                    {(
                      ["kN*m", "N*m", "N*mm", "lb*ft", "kip*ft"] as MomentUnit[]
                    ).map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[110px]">
                  <label className="ml-1 mb-1 block text-[8px] font-black uppercase tracking-widest text-gray-500">
                    Length
                  </label>
                  <select
                    value={resultUnits.length}
                    onChange={(e) =>
                      setResultUnits((prev) => ({
                        ...prev,
                        length: e.target.value as LengthUnit,
                      }))
                    }
                    className="w-full bg-black border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase text-gray-300 outline-none"
                  >
                    {(["m", "cm", "mm", "ft", "in"] as LengthUnit[]).map(
                      (u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>
              <button
                onClick={applyDefaultsToResultUnits}
                className="self-start rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400 transition-colors hover:text-white"
              >
                Reset Result Units To App Defaults
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadReport}
                  className="px-4 py-2 bg-[var(--primary)] hover:opacity-90 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-[var(--primary-glow)]"
                >
                  Download Report
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(formattedSolveData);
                  }}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10"
                >
                  Copy Buffer
                </button>
              </div>
            </div>
          </header>

          <div className="space-y-10">
            {solveResults && (
              <>
                <section>
                  <h3 className="text-gray-500 font-black uppercase tracking-widest text-[10px] mb-6 flex items-center gap-3">
                    <div className="w-1 h-3 bg-[var(--primary)] rounded-full"></div>
                    Fixed End Moments (FEMs)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {solveResults.fems.map((f, i) => (
                      <div
                        key={i}
                        className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl hover:border-[var(--primary)]/30 transition-all group"
                      >
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-3 tracking-tighter">
                          Member {f.span}
                        </p>
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest">
                              Start
                            </span>
                            <span className="text-xl font-black text-[var(--primary)] tabular-nums group-hover:drop-shadow-[0_0_8px_var(--primary-glow)] transition-all">
                              {toDisplayMoment(f.start).toFixed(2)}
                              <span className="ml-1 text-[8px] font-medium opacity-60">
                                {resultUnits.moment}
                              </span>
                            </span>
                          </div>
                          <div className="w-px h-8 bg-white/5 mx-4"></div>
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest">
                              End
                            </span>
                            <span className="text-xl font-black text-[var(--primary)] tabular-nums group-hover:drop-shadow-[0_0_8px_var(--primary-glow)] transition-all">
                              {toDisplayMoment(f.end).toFixed(2)}
                              <span className="ml-1 text-[8px] font-medium opacity-60">
                                {resultUnits.moment}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-gray-500 font-black uppercase tracking-widest text-[10px] mb-6 flex items-center gap-3">
                    <div className="w-1 h-3 bg-[var(--accent)] rounded-full"></div>
                    Final Span End Moments
                  </h3>
                  <div className="space-y-3">
                    {solveResults.endMoments.map((m, i) => (
                      <div
                        key={i}
                        className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex items-center justify-between hover:bg-white/[0.04] transition-colors group"
                      >
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-tighter italic">
                          {m.span}
                        </span>
                        <div className="flex gap-12">
                          <div className="flex items-baseline gap-2">
                            <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">
                              Left:
                            </span>
                            <span className="text-sm font-bold text-[var(--accent)] tracking-tight group-hover:drop-shadow-[0_0_8px_var(--accent-glow)] transition-all">
                              {toDisplayMoment(m.left).toFixed(2)}{" "}
                              <span className="text-[8px] font-medium opacity-50">
                                {resultUnits.moment}
                              </span>
                            </span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">
                              Right:
                            </span>
                            <span className="text-sm font-bold text-[var(--accent)] tracking-tight group-hover:drop-shadow-[0_0_8px_var(--accent-glow)] transition-all">
                              {toDisplayMoment(m.right).toFixed(2)}{" "}
                              <span className="text-[8px] font-medium opacity-50">
                                {resultUnits.moment}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-gray-500 font-black uppercase tracking-widest text-[10px] mb-6 flex items-center gap-3">
                    <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
                    Support Nodal Reactions
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {solveResults.reactions.map((r, i) => (
                      <div
                        key={i}
                        className="bg-[#0c0c0c] border border-white/5 p-5 rounded-2xl relative overflow-hidden group hover:border-blue-500/30 transition-all"
                      >
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-blue-500"
                          >
                            <path d="m11 17-5-5 5-5" />
                            <path d="m18 17-5-5 5-5" />
                          </svg>
                        </div>
                        <h4 className="text-[10px] font-black text-[var(--primary)] uppercase mb-4 tracking-widest border-l-2 border-[var(--primary)] pl-2">
                          {r.id}
                        </h4>
                        <div className="space-y-4">
                          {r.x !== undefined && (
                            <div className="flex items-end justify-between border-b border-white/5 pb-2">
                              <span className="text-[8px] font-bold text-gray-600 uppercase">
                                X - Reaction
                              </span>
                              <span className="text-lg font-black text-blue-400 tabular-nums">
                                {toDisplayForce(r.x).toFixed(2)}{" "}
                                <span className="text-[10px] text-gray-500 font-medium">
                                  {resultUnits.force}
                                </span>
                              </span>
                            </div>
                          )}
                          <div className="flex items-end justify-between">
                            <span className="text-[8px] font-bold text-gray-600 uppercase">
                              Y - Reaction
                            </span>
                            <span className="text-lg font-black text-blue-400 tabular-nums">
                              {toDisplayForce(r.y).toFixed(2)}{" "}
                              <span className="text-[10px] text-gray-500 font-medium">
                                {resultUnits.force}
                              </span>
                            </span>
                          </div>
                          {r.m !== undefined && (
                            <div className="flex items-end justify-between border-t border-white/5 pt-2">
                              <span className="text-[8px] font-bold text-gray-600 uppercase">
                                M - Reaction
                              </span>
                              <span className="text-lg font-black text-blue-400 tabular-nums">
                                {toDisplayMoment(r.m).toFixed(2)}{" "}
                                <span className="text-[10px] text-gray-500 font-medium">
                                  {resultUnits.moment}
                                </span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

              </>
            )}

            {/* Diagram Visualization Section */}
            {solveResults &&
              (isFrameMode ? (
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-gray-500 font-black uppercase tracking-widest text-[10px] flex items-center gap-3">
                      <div className="w-1 h-3 bg-gradient-to-b from-blue-500 to-emerald-500 rounded-full"></div>
                      Force Diagrams on Structure
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setActiveDiagram(
                            activeDiagram === "bmd" ? "none" : "bmd",
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                          activeDiagram === "bmd" || activeDiagram === "both"
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            : "bg-white/5 text-gray-500 hover:text-white border border-white/5"
                        }`}
                      >
                        BMD
                      </button>
                      <button
                        onClick={() =>
                          setActiveDiagram(
                            activeDiagram === "sfd" ? "none" : "sfd",
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                          activeDiagram === "sfd" || activeDiagram === "both"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-white/5 text-gray-500 hover:text-white border border-white/5"
                        }`}
                      >
                        SFD
                      </button>
                      <button
                        onClick={() =>
                          setActiveDiagram(
                            activeDiagram === "both" ? "none" : "both",
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                          activeDiagram === "both"
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                            : "bg-white/5 text-gray-500 hover:text-white border border-white/5"
                        }`}
                      >
                        Both
                      </button>
                    </div>
                  </div>
                  <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden min-h-[400px]">
                    <StructurePreview
                      members={members}
                      diagramData={diagramData}
                      activeDiagram={activeDiagram}
                      diagramUnits={{
                        momentUnit: resultUnits.moment,
                        shearUnit: resultUnits.force,
                      }}
                      hideLoads={true}
                      autoHeight={true}
                    />
                  </div>
                  <div className="flex items-center gap-6 mt-4 text-[10px] text-gray-500">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-0.5 bg-blue-500 rounded"></div>
                      Bending Moment ({resultUnits.moment})
                    </span>
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-0.5 bg-emerald-500 rounded"></div>
                      Shear Force ({resultUnits.force})
                    </span>
                  </div>
                </section>
              ) : (
                <DiagramsSection
                  beamDiagrams={solveResults?.beamDiagrams || []}
                  resultUnits={resultUnits}
                />
              ))}

            {(solveResults &&
              (solveResults.design.beams.length > 0 ||
                solveResults.design.supports.length > 0 ||
                solveResults.design.columns.length > 0)) && (
              <section>
                <div className="mb-6 rounded-2xl border border-white/10 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-emerald-500/10 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">
                    Design Studio
                  </p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-white">
                    RCC Design Results (Workflow: Design Mode)
                  </h3>
                  <p className="mt-2 text-[11px] text-gray-400">
                    Computed from solved force envelopes using the existing RCC
                    design workflow.
                  </p>
                  <p className="mt-2 text-[10px] text-gray-500">
                    Assumptions: fcu {solveResults.design.assumptions.fcu} N/mm^2, fy{" "}
                    {solveResults.design.assumptions.fy} N/mm^2, cover{" "}
                    {solveResults.design.assumptions.concreteCover_mm} mm, links{" "}
                    {solveResults.design.assumptions.linkDiameter_mm} mm.
                  </p>
                  <p className="mt-2 text-[10px] text-gray-500">
                    Mu+ is maximum sagging (positive) design moment, Mu- is
                    maximum hogging (negative) design moment.
                  </p>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {solveResults.design.checks.map((check) => (
                      <div
                        key={`check-${check.id}`}
                        className="rounded-xl border border-white/10 bg-black/20 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-bold text-gray-200">
                            {check.name}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-black tracking-widest ${
                              check.status === "IMPLEMENTED"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : check.status === "PARTIAL"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-red-500/20 text-red-300"
                            }`}
                          >
                            {check.status}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-gray-400">{check.notes}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {solveResults.design.beams.length > 0 && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                        Span Design Results
                      </p>
                      <p className="mt-1 text-[10px] text-gray-400">
                        One card per span/member in workflow mode set to Design.
                      </p>
                    </div>
                    {solveResults.design.beams.map((beam) => (
                      <article
                        key={`design-beam-${beam.memberLabel}`}
                        className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-5 shadow-2xl"
                      >
                        <div className="mb-3 flex items-center justify-between gap-4">
                          <h4 className="text-sm font-black uppercase tracking-widest text-gray-200">
                            {beam.memberLabel} Beam
                          </h4>
                          <span
                            className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${
                              beam.status === "OK"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : beam.status === "CHECK"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-red-500/20 text-red-300"
                            }`}
                          >
                            {beam.status}
                          </span>
                        </div>

                        <p className="text-[11px] text-gray-400 mb-3">
                          {beam.message}
                        </p>

                        {beam.flexure && (
                          <>
                            <div className="mb-3 grid grid-cols-1 sm:grid-cols-4 gap-2 text-[10px]">
                              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2">
                                d: {beam.flexure.d.toFixed(2)} mm
                              </div>
                              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2">
                                As,min: {beam.flexure.AsMin.toFixed(2)} mm^2
                              </div>
                              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2">
                                As,max: {beam.flexure.AsMax.toFixed(2)} mm^2
                              </div>
                              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2">
                                Mu+ (sagging) / Mu- (hogging):{" "}
                                {beam.spanMoment?.toFixed(2) ?? "-"} /{" "}
                                {beam.supportMoment?.toFixed(2) ?? "-"} kNm
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                                  Span Zone
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                  <p>K: {beam.flexure.span.K?.toFixed(4) ?? "-"}</p>
                                  <p>z: {beam.flexure.span.z?.toFixed(2) ?? "-"} mm</p>
                                  <p>x: {beam.flexure.span.x?.toFixed(2) ?? "-"} mm</p>
                                  <p>As req: {beam.flexure.bottomSteelRequired?.toFixed(2) ?? "-"} mm^2</p>
                                  <p className="col-span-2">
                                    As prov:{" "}
                                    {beam.spanBars
                                      ? `${beam.spanBars.area.toFixed(2)} mm^2 (${beam.spanBars.label})`
                                      : "-"}
                                  </p>
                                </div>
                              </div>

                              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                                  Serviceability Checks
                                </p>
                                <div className="space-y-2 text-[10px]">
                                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                      <p className="text-gray-300">Deflection (L/d)</p>
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[9px] font-black tracking-widest ${
                                          beam.deflectionCheck.status === "OK"
                                            ? "bg-emerald-500/20 text-emerald-300"
                                            : beam.deflectionCheck.status === "CHECK"
                                              ? "bg-amber-500/20 text-amber-300"
                                              : "bg-white/10 text-gray-300"
                                        }`}
                                      >
                                        {beam.deflectionCheck.status}
                                      </span>
                                    </div>
                                    <p className="text-gray-400">
                                      Actual/Limit:{" "}
                                      {beam.deflectionCheck.actual !== null
                                        ? beam.deflectionCheck.actual.toFixed(2)
                                        : "-"}{" "}
                                      /{" "}
                                      {beam.deflectionCheck.limit !== null
                                        ? beam.deflectionCheck.limit.toFixed(2)
                                        : "-"}{" "}
                                      {beam.deflectionCheck.units}
                                    </p>
                                    <p className="text-gray-500">{beam.deflectionCheck.message}</p>
                                  </div>
                                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                      <p className="text-gray-300">Crack Width</p>
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[9px] font-black tracking-widest ${
                                          beam.crackWidthCheck.status === "OK"
                                            ? "bg-emerald-500/20 text-emerald-300"
                                            : beam.crackWidthCheck.status === "CHECK"
                                              ? "bg-amber-500/20 text-amber-300"
                                              : "bg-white/10 text-gray-300"
                                        }`}
                                      >
                                        {beam.crackWidthCheck.status}
                                      </span>
                                    </div>
                                    <p className="text-gray-400">
                                      Estimated/Limit:{" "}
                                      {beam.crackWidthCheck.actual !== null
                                        ? beam.crackWidthCheck.actual.toFixed(3)
                                        : "-"}{" "}
                                      /{" "}
                                      {beam.crackWidthCheck.limit !== null
                                        ? beam.crackWidthCheck.limit.toFixed(3)
                                        : "-"}{" "}
                                      {beam.crackWidthCheck.units}
                                    </p>
                                    <p className="text-gray-500">{beam.crackWidthCheck.message}</p>
                                  </div>
                                </div>
                              </div>

                              {beam.shearZones.length > 0 && (
                                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                                    Shear Check Zones
                                  </p>
                                  <div className="space-y-2 text-[10px]">
                                    {beam.shearZones.map((zone, zoneIdx) => (
                                      <div
                                        key={`zone-${beam.memberLabel}-${zoneIdx}`}
                                        className="rounded-lg border border-white/10 bg-white/[0.02] p-2"
                                      >
                                        <div className="mb-1 flex items-center justify-between gap-2">
                                          <p className="text-gray-300">
                                            Global x = {zone.startX.toFixed(2)} m to{" "}
                                            {zone.endX.toFixed(2)} m
                                          </p>
                                          <span
                                            className={`rounded-full px-2 py-0.5 text-[9px] font-black tracking-widest ${
                                              zone.status === "OK"
                                                ? "bg-emerald-500/20 text-emerald-300"
                                                : zone.status === "WARNING"
                                                  ? "bg-amber-500/20 text-amber-300"
                                                  : "bg-red-500/20 text-red-300"
                                            }`}
                                          >
                                            {zone.status}
                                          </span>
                                        </div>
                                        <p className="text-gray-400">
                                          {zone.condition} | {zone.instruction}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </article>
                    ))}
                  </div>
                )}

                {solveResults.design.supports.length > 0 && (
                  <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3 md:col-span-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                        Support Design Results
                      </p>
                      <p className="mt-1 text-[10px] text-gray-400">
                        One card per support node, using governing hogging moment
                        from connected design spans.
                      </p>
                    </div>
                    {solveResults.design.supports.map((support) => (
                      <article
                        key={`design-support-${support.supportLabel}`}
                        className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-5"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="text-sm font-black uppercase tracking-widest text-gray-200">
                            Support {support.supportLabel}
                          </h4>
                          <span
                            className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${
                              support.status === "OK"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : support.status === "CHECK"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-red-500/20 text-red-300"
                            }`}
                          >
                            {support.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400">{support.message}</p>
                        <p className="mt-2 text-[10px] text-gray-500">
                          Connected spans: {support.connectedMembers.join(", ")}
                        </p>
                        {support.governingMoment !== null && (
                          <p className="mt-2 text-[10px] text-gray-500">
                            Governing support end moment used:{" "}
                            {support.governingMoment.toFixed(2)} kNm
                          </p>
                        )}
                        {(support.K !== null ||
                          support.AsRequired !== null ||
                          support.AsProvided) && (
                          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                            <p>K: {support.K?.toFixed(4) ?? "-"}</p>
                            <p>z: {support.z?.toFixed(2) ?? "-"} mm</p>
                            <p>x: {support.x?.toFixed(2) ?? "-"} mm</p>
                            <p>d: {support.d?.toFixed(2) ?? "-"} mm</p>
                            <p>As req: {support.AsRequired?.toFixed(2) ?? "-"} mm^2</p>
                            <p>As min: {support.AsMin?.toFixed(2) ?? "-"} mm^2</p>
                            <p className="col-span-2">
                              As prov:{" "}
                              {support.AsProvided
                                ? `${support.AsProvided.area.toFixed(2)} mm^2 (${support.AsProvided.label})`
                                : "-"}
                            </p>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}

                {solveResults.design.columns.length > 0 && (
                  <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3 md:col-span-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                        Column Design Results (Short Braced)
                      </p>
                      <p className="mt-1 text-[10px] text-gray-400">
                        Generated from the short braced column workflow in the RCC
                        design module.
                      </p>
                    </div>
                    {solveResults.design.columns.map((column) => (
                      <article
                        key={`design-col-${column.memberLabel}`}
                        className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-5"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="text-sm font-black uppercase tracking-widest text-gray-200">
                            {column.memberLabel} Column
                          </h4>
                          <span
                            className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${
                              column.status === "SUCCESS"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : column.status === "SKIPPED"
                                  ? "bg-white/10 text-gray-300"
                                  : "bg-amber-500/20 text-amber-300"
                            }`}
                          >
                            {column.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400">{column.message}</p>
                        {column.axialLoadUsed !== null && (
                          <p className="mt-2 text-[10px] text-gray-500">
                            Axial load used: {column.axialLoadUsed.toFixed(2)} kN
                          </p>
                        )}
                        {column.result?.status === "SUCCESS" && (
                          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                            <p>Asc req: {column.result.steelRequiredArea ?? 0} mm^2</p>
                            <p>Provided: {column.result.providedSteel ?? "-"}</p>
                            <p>Asc prov: {column.result.providedArea ?? 0} mm^2</p>
                            <p>Links: {column.result.links ?? "-"}</p>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          <footer className="mt-8 flex justify-center">
            <p className="text-[10px] text-gray-600 italic font-medium">
              Model output successfully synchronized with terminal console.
            </p>
          </footer>
        </div>
      </Modal>

      {/* Background Ambient Effects */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-20 overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-[var(--primary)] rounded-full blur-[160px] opacity-30"></div>
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[50%] bg-[var(--accent)] rounded-full blur-[180px] opacity-20"></div>
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={null}>
      <AnalysisContent />
    </Suspense>
  );
}
