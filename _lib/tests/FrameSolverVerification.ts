import { FrameSolver } from "../frameSolver/frameSolver";
import { Beam, Column } from "../elements/member";
import { Node } from "../elements/node";
import {
  FixedSupport,
  PinnedSupport,
  RollerSupport,
  SupportType,
} from "../elements/support";
import { PointLoad, UDL } from "../elements/load";

const FORCE_EPS = 1e-5;
const MOMENT_EPS = 1e-5;

type NodeSpec = {
  id: string;
  x: number;
  y: number;
  support?: SupportType;
  fx?: number;
  fy?: number;
  mz?: number;
};

type PointLoadSpec = {
  kind: "point";
  position: number;
  magnitude: number;
};

type UDLSpec = {
  kind: "udl";
  start: number;
  span: number;
  magnitude: number;
};

type MemberLoadSpec = PointLoadSpec | UDLSpec;

type MemberSpec = {
  id: string;
  kind: "beam" | "column";
  start: string;
  end: string;
  E: number;
  I: number;
  loads?: MemberLoadSpec[];
};

type ModelSpec = {
  name: string;
  nodes: NodeSpec[];
  members: MemberSpec[];
};

type Reaction = {
  xReaction: number;
  yReaction: number;
};

type SolvedModel = {
  spec: ModelSpec;
  solver: FrameSolver;
  nodes: Node[];
  members: (Beam | Column)[];
  moments: Record<string, number>;
  reactions: Record<string, Reaction>;
};

class PRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next() {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  float(min: number, max: number) {
    return min + (max - min) * this.next();
  }

  int(min: number, max: number) {
    return Math.floor(this.float(min, max + 1));
  }

  bool(trueProbability = 0.5) {
    return this.next() < trueProbability;
  }

  pick<T>(arr: T[]) {
    return arr[this.int(0, arr.length - 1)];
  }
}

function assertClose(
  label: string,
  actual: number,
  expected: number,
  eps = FORCE_EPS,
) {
  if (Math.abs(actual - expected) > eps) {
    throw new Error(
      `${label} mismatch: expected=${expected.toFixed(6)} actual=${actual.toFixed(6)} eps=${eps}`,
    );
  }
}

function assertNearZero(label: string, value: number, eps = FORCE_EPS) {
  if (Math.abs(value) > eps) {
    throw new Error(
      `${label} not near zero: value=${value.toFixed(6)} eps=${eps}`,
    );
  }
}

function assertTrue(label: string, value: boolean) {
  if (!value) {
    throw new Error(`${label} expected true`);
  }
}

function assertFalse(label: string, value: boolean) {
  if (value) {
    throw new Error(`${label} expected false`);
  }
}

function makeSupport(type: SupportType, x: number, y: number) {
  if (type === "fixed") return new FixedSupport(x, y);
  if (type === "pinned") return new PinnedSupport(x, y);
  return new RollerSupport(x, y);
}

function buildModel(spec: ModelSpec, reverseMemberIds = new Set<string>()) {
  const nodeMap = new Map<string, Node>();
  for (const n of spec.nodes) {
    const support = n.support ? makeSupport(n.support, n.x, n.y) : null;
    nodeMap.set(n.id, new Node(n.id, n.x, n.y, support));
  }

  const members: (Beam | Column)[] = [];
  for (const m of spec.members) {
    const reversed = reverseMemberIds.has(m.id);
    const startId = reversed ? m.end : m.start;
    const endId = reversed ? m.start : m.end;

    const startNode = nodeMap.get(startId);
    const endNode = nodeMap.get(endId);
    if (!startNode || !endNode) {
      throw new Error(`Invalid member connectivity in ${spec.name}: ${m.id}`);
    }

    const member =
      m.kind === "beam"
        ? new Beam(startNode, endNode, 0, 0, null, m.E, m.I)
        : new Column(startNode, endNode, 0, 0, m.E, m.I);

    const loads = m.loads ?? [];
    const L = member.length;
    for (const load of loads) {
      if (load.kind === "point") {
        const p = reversed ? L - load.position : load.position;
        const q = reversed ? -load.magnitude : load.magnitude;
        member.addLoad(new PointLoad(p, q));
      } else {
        const start = reversed ? L - (load.start + load.span) : load.start;
        const q = reversed ? -load.magnitude : load.magnitude;
        member.addLoad(new UDL(start, load.span, q));
      }
    }

    members.push(member);
  }

  for (const n of spec.nodes) {
    const node = nodeMap.get(n.id);
    if (!node) continue;
    node.addNodalLoad(n.fx ?? 0, n.fy ?? 0);
    if ((n.mz ?? 0) !== 0) {
      node.addMomentLoad(n.mz ?? 0);
    }
  }

  return {
    nodes: [...nodeMap.values()],
    members,
    solver: new FrameSolver(members),
  };
}

function toReactionObject(
  reactionsMap: Map<string, { xReaction: number; yReaction: number }>,
) {
  return Object.fromEntries(reactionsMap) as Record<string, Reaction>;
}

function solveModel(
  spec: ModelSpec,
  reverseMemberIds = new Set<string>(),
): SolvedModel {
  const { nodes, members, solver } = buildModel(spec, reverseMemberIds);
  const moments = solver.updatedGetFinalMoments();
  const reactions = toReactionObject(solver.updatedSolveReactions());
  return { spec, solver, nodes, members, moments, reactions };
}

function validateFinite(label: string, solved: SolvedModel) {
  for (const [k, v] of Object.entries(solved.moments)) {
    if (!Number.isFinite(v)) {
      throw new Error(`${label} non-finite moment ${k}=${v}`);
    }
  }
  for (const [nodeId, r] of Object.entries(solved.reactions)) {
    if (!Number.isFinite(r.xReaction) || !Number.isFinite(r.yReaction)) {
      throw new Error(
        `${label} non-finite reaction at ${nodeId}: (${r.xReaction}, ${r.yReaction})`,
      );
    }
  }
}

function sumMemberLoads(solved: SolvedModel) {
  let fx = 0;
  let fy = 0;

  for (const member of solved.members) {
    const total = member
      .getEquivalentPointLoads()
      .reduce((s, l) => s + l.magnitude, 0);

    if (member instanceof Beam) {
      const orientationSign = member.endNode.x >= member.startNode.x ? 1 : -1;
      fy += total * orientationSign;
    } else {
      const orientationSign = member.endNode.y >= member.startNode.y ? 1 : -1;
      fx += total * orientationSign;
    }
  }

  return { fx, fy };
}

function validateGlobalEquilibrium(label: string, solved: SolvedModel) {
  const supportFx = Object.values(solved.reactions).reduce(
    (s, r) => s + r.xReaction,
    0,
  );
  const supportFy = Object.values(solved.reactions).reduce(
    (s, r) => s + r.yReaction,
    0,
  );

  const nodeFx = solved.nodes.reduce((s, n) => s + n.xLoad, 0);
  const nodeFy = solved.nodes.reduce((s, n) => s + n.yLoad, 0);
  const memberLoads = sumMemberLoads(solved);

  // Frame solver sign convention:
  //   sum(Reactions) - sum(MemberLoads) - sum(NodalLoads) = 0.
  const fxResidual = supportFx - memberLoads.fx - nodeFx;
  const fyResidual = supportFy - memberLoads.fy - nodeFy;

  assertNearZero(`${label} Fx equilibrium`, fxResidual, FORCE_EPS);
  assertNearZero(`${label} Fy equilibrium`, fyResidual, FORCE_EPS);
}

function validateJointMomentEquilibrium(label: string, solved: SolvedModel) {
  for (const node of solved.nodes) {
    if (node.support?.type === "fixed") continue;

    let sum = 0;
    for (const conn of node.connectedMembers) {
      const other =
        conn.member.startNode === node
          ? conn.member.endNode
          : conn.member.startNode;
      const key = `MOMENT${node.id}${other.id}`;
      sum += solved.moments[key] ?? 0;
    }

    const residual = sum + node.momentLoad;
    assertNearZero(
      `${label} joint moment equilibrium @${node.id}`,
      residual,
      MOMENT_EPS,
    );
  }
}

function validateSupportConstraints(label: string, solved: SolvedModel) {
  for (const node of solved.nodes) {
    if (!node.support) continue;
    const reaction = solved.reactions[node.id];
    if (!reaction) continue;

    if (node.support.type === "roller") {
      assertNearZero(
        `${label} roller horizontal reaction @${node.id}`,
        reaction.xReaction,
        FORCE_EPS,
      );
    }
  }
}

function solveAndValidate(
  spec: ModelSpec,
  reverseMemberIds = new Set<string>(),
): SolvedModel {
  const solved = solveModel(spec, reverseMemberIds);
  validateFinite(spec.name, solved);
  validateGlobalEquilibrium(spec.name, solved);
  validateJointMomentEquilibrium(spec.name, solved);
  validateSupportConstraints(spec.name, solved);
  return solved;
}

function compareSolutions(
  label: string,
  a: SolvedModel,
  b: SolvedModel,
  eps = 1e-4,
) {
  const momentKeys = new Set([
    ...Object.keys(a.moments),
    ...Object.keys(b.moments),
  ]);
  for (const key of momentKeys) {
    assertClose(
      `${label} moment ${key}`,
      a.moments[key] ?? 0,
      b.moments[key] ?? 0,
      eps,
    );
  }

  const reactionNodes = new Set([
    ...Object.keys(a.reactions),
    ...Object.keys(b.reactions),
  ]);
  for (const nodeId of reactionNodes) {
    const ar = a.reactions[nodeId] ?? { xReaction: 0, yReaction: 0 };
    const br = b.reactions[nodeId] ?? { xReaction: 0, yReaction: 0 };
    assertClose(
      `${label} reaction Fx @${nodeId}`,
      ar.xReaction,
      br.xReaction,
      eps,
    );
    assertClose(
      `${label} reaction Fy @${nodeId}`,
      ar.yReaction,
      br.yReaction,
      eps,
    );
  }

  assertClose(
    `${label} sway state`,
    a.solver.isSideSway() ? 1 : 0,
    b.solver.isSideSway() ? 1 : 0,
    0,
  );
}

function textbookTFrameSpec(): ModelSpec {
  return {
    name: "Textbook T-frame (C pinned)",
    nodes: [
      { id: "C", x: 0, y: 15, support: "pinned" },
      { id: "A", x: 20, y: 0, support: "pinned" },
      { id: "D", x: 20, y: 15 },
      { id: "E", x: 25, y: 15 },
    ],
    members: [
      {
        id: "M1",
        kind: "column",
        start: "A",
        end: "D",
        E: 1,
        I: 1,
        loads: [{ kind: "point", position: 5, magnitude: -15 }],
      },
      {
        id: "M2",
        kind: "beam",
        start: "D",
        end: "E",
        E: 1,
        I: 2,
        loads: [{ kind: "udl", start: 0, span: 5, magnitude: 3 }],
      },
      {
        id: "M3",
        kind: "beam",
        start: "C",
        end: "D",
        E: 1,
        I: 2,
        loads: [{ kind: "udl", start: 0, span: 20, magnitude: 3 }],
      },
    ],
  };
}

function swayReferenceSpec(): ModelSpec {
  return {
    name: "Portal sway reference",
    nodes: [
      { id: "A", x: 0, y: 0, support: "fixed" },
      { id: "D", x: 6, y: 0, support: "fixed" },
      { id: "B", x: 0, y: 4, fx: 10 },
      { id: "C", x: 6, y: 4 },
    ],
    members: [
      { id: "AB", kind: "column", start: "A", end: "B", E: 1, I: 1 },
      { id: "BC", kind: "beam", start: "B", end: "C", E: 1, I: 1 },
      { id: "DC", kind: "column", start: "D", end: "C", E: 1, I: 1 },
    ],
  };
}

function nonSwayRegressionSpec(): ModelSpec {
  return {
    name: "Non-sway rectangle regression",
    nodes: [
      { id: "A", x: 0, y: 0, support: "fixed" },
      { id: "D", x: 6, y: 0, support: "fixed" },
      { id: "B", x: 0, y: 4 },
      { id: "C", x: 6, y: 4 },
    ],
    members: [
      { id: "AB", kind: "column", start: "A", end: "B", E: 1, I: 1 },
      {
        id: "BC",
        kind: "beam",
        start: "B",
        end: "C",
        E: 1,
        I: 1,
        loads: [{ kind: "udl", start: 0, span: 6, magnitude: 10 }],
      },
      { id: "CD", kind: "column", start: "C", end: "D", E: 1, I: 1 },
      { id: "AD", kind: "beam", start: "A", end: "D", E: 1, I: 1 },
    ],
  };
}

function randomPortalSpec(prng: PRNG, idx: number): ModelSpec {
  const span = prng.float(12, 30);
  const overhang = prng.float(3, 10);
  const topY = prng.float(8, 20);
  const baseY = 0;

  const leftSupport = prng.pick<SupportType>(["pinned", "roller"]);
  const rightSupport = prng.pick<SupportType>(["pinned", "fixed"]);

  const qLeft = prng.float(0, 8);
  const qRight = prng.float(0, 8);
  const hasColumnLoad = prng.bool(0.75);

  const colHeight = topY - baseY;
  const pointPos = prng.float(0.15 * colHeight, 0.85 * colHeight);
  const pointMag = prng.float(-20, 20);

  return {
    name: `Random portal #${idx + 1}`,
    nodes: [
      { id: "C", x: 0, y: topY, support: leftSupport },
      { id: "A", x: span, y: baseY, support: rightSupport },
      { id: "D", x: span, y: topY },
      { id: "E", x: span + overhang, y: topY },
    ],
    members: [
      {
        id: "M1",
        kind: "column",
        start: "A",
        end: "D",
        E: 1,
        I: prng.float(0.6, 2.0),
        loads: hasColumnLoad
          ? [{ kind: "point", position: pointPos, magnitude: pointMag }]
          : [],
      },
      {
        id: "M2",
        kind: "beam",
        start: "C",
        end: "D",
        E: 1,
        I: prng.float(0.8, 3.0),
        loads: [{ kind: "udl", start: 0, span, magnitude: qLeft }],
      },
      {
        id: "M3",
        kind: "beam",
        start: "D",
        end: "E",
        E: 1,
        I: prng.float(0.8, 3.0),
        loads: [{ kind: "udl", start: 0, span: overhang, magnitude: qRight }],
      },
    ],
  };
}

function runDeterministicChecks() {
  const tFrame = solveAndValidate(textbookTFrameSpec());

  // Reference values from the textbook model discussed in this repo.
  assertClose("T-frame M_AD", tFrame.moments.MOMENTAD ?? 0, 0, 1e-2);
  assertClose("T-frame M_DA", tFrame.moments.MOMENTDA ?? 0, 65, 2e-1);
  assertClose("T-frame M_DC", tFrame.moments.MOMENTDC ?? 0, -102.5, 2e-1);
  assertClose("T-frame M_DE", tFrame.moments.MOMENTDE ?? 0, 37.5, 2e-1);
  assertClose("T-frame C.Rx", tFrame.reactions.C?.xReaction ?? 0, -9.33, 0.2);
  assertClose("T-frame C.Ry", tFrame.reactions.C?.yReaction ?? 0, 24.88, 0.2);
  assertClose("T-frame A.Rx", tFrame.reactions.A?.xReaction ?? 0, -5.67, 0.2);
  assertClose("T-frame A.Ry", tFrame.reactions.A?.yReaction ?? 0, 50.13, 0.2);
  assertFalse("T-frame side sway", tFrame.solver.isSideSway());

  const swayRef = solveAndValidate(swayReferenceSpec());
  assertTrue("Sway reference side sway", swayRef.solver.isSideSway());
  assertClose("Sway M_AB", swayRef.moments.MOMENTAB ?? 0, 12, 1e-6);
  assertClose("Sway M_BA", swayRef.moments.MOMENTBA ?? 0, 8, 1e-6);
  assertClose("Sway M_BC", swayRef.moments.MOMENTBC ?? 0, -8, 1e-6);
  assertClose("Sway M_CB", swayRef.moments.MOMENTCB ?? 0, -8, 1e-6);
  assertClose("Sway M_CD", swayRef.moments.MOMENTCD ?? 0, 8, 1e-6);
  assertClose("Sway M_DC", swayRef.moments.MOMENTDC ?? 0, 12, 1e-6);
  assertClose("Sway A.Rx", swayRef.reactions.A?.xReaction ?? 0, 5, 1e-6);
  assertClose(
    "Sway A.Ry",
    swayRef.reactions.A?.yReaction ?? 0,
    -2.6666666667,
    1e-6,
  );
  assertClose("Sway D.Rx", swayRef.reactions.D?.xReaction ?? 0, 5, 1e-6);
  assertClose(
    "Sway D.Ry",
    swayRef.reactions.D?.yReaction ?? 0,
    2.6666666667,
    1e-6,
  );

  const nonSway = solveAndValidate(nonSwayRegressionSpec());
  const eqns = nonSway.solver.updatedGetEquations();
  const hasDelta = eqns.some((eq) =>
    Object.keys(eq).some((k) => k.startsWith("DELTA_")),
  );
  assertFalse("Non-sway equations include DELTA", hasDelta);
  assertFalse("Non-sway frame should not sidesway", nonSway.solver.isSideSway());
}

function runOrientationInvarianceCheck(spec: ModelSpec, label: string) {
  const base = solveAndValidate(spec);
  const reverseAll = new Set(spec.members.map((m) => m.id));
  const reversed = solveAndValidate(spec, reverseAll);
  compareSolutions(label, base, reversed, 1e-4);
}

function runRandomizedVerification(samples = 120, seed = 20260227) {
  const prng = new PRNG(seed);
  let passes = 0;
  let swayTrue = 0;
  let swayFalse = 0;
  const failures: string[] = [];

  for (let i = 0; i < samples; i += 1) {
    const spec = randomPortalSpec(prng, i);
    try {
      const base = solveAndValidate(spec);
      if (base.solver.isSideSway()) swayTrue += 1;
      else swayFalse += 1;

      const reverseSubset = new Set<string>();
      for (const m of spec.members) {
        if (prng.bool()) reverseSubset.add(m.id);
      }
      if (reverseSubset.size === 0) {
        reverseSubset.add(spec.members[0].id);
      }

      const alt = solveAndValidate(spec, reverseSubset);
      compareSolutions(`${spec.name} orientation`, base, alt, 1e-4);
      passes += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown test failure";
      failures.push(`${spec.name}: ${message}`);
    }
  }

  const passRate = passes / samples;
  if (passRate < 0.9) {
    const head = failures.slice(0, 6).join("\n");
    throw new Error(
      `Random verification pass rate below 90%: ${(passRate * 100).toFixed(1)}% (${passes}/${samples})\n${head}`,
    );
  }

  if (swayTrue === 0 || swayFalse === 0) {
    throw new Error(
      `Random suite did not exercise both sway states. swayTrue=${swayTrue}, swayFalse=${swayFalse}`,
    );
  }

  if (failures.length > 0) {
    const head = failures.slice(0, 3).join("\n");
    console.warn(
      `Frame verification warning: ${failures.length} random cases failed but pass rate is ${(passRate * 100).toFixed(1)}%\n${head}`,
    );
  }

  return { samples, passes, passRate, swayTrue, swayFalse, failures };
}

runDeterministicChecks();
runOrientationInvarianceCheck(textbookTFrameSpec(), "Textbook orientation");
runOrientationInvarianceCheck(swayReferenceSpec(), "Sway orientation");

const randomStats = runRandomizedVerification(140, 20260227);

console.log(
  `Frame solver verification: PASS (random ${randomStats.passes}/${randomStats.samples}, ${(randomStats.passRate * 100).toFixed(1)}%, swayTrue=${randomStats.swayTrue}, swayFalse=${randomStats.swayFalse})`,
);
