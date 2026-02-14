import { Node as SolverNode } from "./_lib/elements/node";
import { Beam, Column, InclinedMember } from "./_lib/elements/member";
import { FixedSupport, PinnedSupport, RollerSupport, Support as SolverSupport } from "./_lib/elements/support";
import { PointLoad as SolverPointLoad, UDL as SolverUDL, VDL as SolverVDL } from "./_lib/elements/load";
import { FrameSolver } from "./_lib/frameSolver/frameSolver";

type SupportType = "None" | "Fixed" | "Pinned" | "Roller";

type FrontMember = {
  startNode: {x:number;y:number};
  endNode: {x:number;y:number};
  memberType?: string;
  supports: { start: SupportType; end: SupportType; startSettlement?: number; endSettlement?: number };
  loads: { type:"Point"|"UDL"|"VDL"; value:number; position?:number; span?:number; highValue?:number; highPosition?:number; lowPosition?:number }[];
  Ecoef?: number;
  Icoef?: number;
  b?: number;
  h?: number;
  slabThickness?: number;
}

const members: FrontMember[] = [
  {
    startNode:{x:0,y:0},
    endNode:{x:0,y:7},
    memberType:"Column",
    supports:{start:"Fixed", end:"None"},
    loads:[],
    Ecoef:1,
    Icoef:1,
    b:0,
    h:0,
    slabThickness:0,
  },
  {
    startNode:{x:0,y:7},
    endNode:{x:7,y:7},
    memberType:"Beam",
    supports:{start:"None", end:"None"},
    loads:[{type:"Point", value:40, position:3}],
    Ecoef:1,
    Icoef:1,
    b:0,
    h:0,
    slabThickness:0,
  },
  {
    startNode:{x:7,y:2},
    endNode:{x:7,y:7},
    memberType:"Column",
    supports:{start:"Fixed", end:"None"},
    loads:[],
    Ecoef:1,
    Icoef:1,
    b:0,
    h:0,
    slabThickness:0,
  },
];

const uniqueNodes = Array.from(
  new Set(members.flatMap((m) => [JSON.stringify(m.startNode), JSON.stringify(m.endNode)])),
).map((s) => JSON.parse(s) as { x: number; y: number }).sort((a, b) => {
  if (a.x !== b.x) return a.x - b.x;
  return a.y - b.y;
});

const nodeSupports: Record<string, { type: string; settlement: number }> = {};
members.forEach((m) => {
  const sKey = JSON.stringify(m.startNode);
  const eKey = JSON.stringify(m.endNode);
  if (m.supports.start !== "None") {
    nodeSupports[sKey] = { type: m.supports.start, settlement: m.supports.startSettlement || 0 };
  }
  if (m.supports.end !== "None") {
    nodeSupports[eKey] = { type: m.supports.end, settlement: m.supports.endSettlement || 0 };
  }
});

const solverNodesMap = new Map<string, SolverNode>();
let lastSupport: SolverSupport | null = null;

uniqueNodes.forEach((n, idx) => {
  const nKey = JSON.stringify(n);
  const supportData = nodeSupports[nKey];
  const supportType = supportData?.type || "None";
  const settlement = supportData?.settlement || 0;

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

  const solverNode = new SolverNode(`N${idx + 1}`, n.x, n.y, support as any);
  solverNodesMap.set(nKey, solverNode);
});

const solverMembers: (Beam | Column | InclinedMember)[] = members.map((m) => {
  const startSolverNode = solverNodesMap.get(JSON.stringify(m.startNode))!;
  const endSolverNode = solverNodesMap.get(JSON.stringify(m.endNode))!;

  const type = m.memberType || "Column";
  let member: Beam | Column | InclinedMember;

  if (type === "Column") {
    member = new Column(startSolverNode, endSolverNode, Number(m.b || 0.3), Number(m.h || 0.3), m.Ecoef, m.Icoef);
  } else if (type === "Beam") {
    member = new Beam(startSolverNode, endSolverNode, Number(m.b || 0.3), Number(m.h || 0.45), null, m.Ecoef, m.Icoef, Number(m.slabThickness || 0));
  } else {
    member = new InclinedMember(startSolverNode, endSolverNode, Number(m.b || 0.3), Number(m.h || 0.3), m.Ecoef, m.Icoef);
  }

  m.loads.forEach((l) => {
    if (l.type === "Point") {
      member.addLoad(new SolverPointLoad(l.position || 0, l.value));
    } else if (l.type === "UDL") {
      member.addLoad(new SolverUDL(l.position || 0, l.span || 0, l.value));
    } else if (l.type === "VDL") {
      member.addLoad(new SolverVDL(Number(l.highValue || 0), Number(l.highPosition || 0), 0, Number(l.lowPosition || 0)));
    }
  });

  return member;
});

const solver = new FrameSolver(solverMembers as any);
const moments = solver.updatedGetFinalMoments();
const reactions = Object.fromEntries(solver.updatedSolveReactions());

console.log("uniqueNodes", uniqueNodes);
console.log("moments", moments);
console.log("reactions", reactions);
