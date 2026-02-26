import { Beam, Column, InclinedMember } from "../elements/member";
import {
  FixedSupport,
  PinnedSupport,
  RollerSupport,
} from "../elements/support";
import { FixedEndMoments } from "../logic/FEMs";
import { SlopeDeflection } from "./slopeDeflectionEqn";
import { Equation } from "../logic/simultaneousEqn";
import { Node } from "../elements/node";
import { assembleNonSwayEquations } from "./analysisModes/nonSway/equationAssembly";
import { assembleSwayEquations } from "./analysisModes/sway/equationAssembly";
import {
  FrameAnalysisMode,
  resolveFrameAnalysisMode,
} from "./analysisModes/resolveAnalysisMode";

export class FrameSolver {
  members: (Beam | Column | InclinedMember)[];
  FEM: FixedEndMoments;
  slopeDeflection: SlopeDeflection;
  equation: Equation;
  verbose: boolean;

  constructor(
    members: (Beam | Column | InclinedMember)[] = [],
    verbose: boolean = false,
  ) {
    this.members = members;
    this.FEM = new FixedEndMoments();
    this.slopeDeflection = new SlopeDeflection();
    this.equation = new Equation();
    this.verbose = verbose;
  }

  private log(message: string) {
    if (this.verbose) console.log(message);
  }

  private validateModel() {
    for (const member of this.members) {
      if (member instanceof InclinedMember) {
        throw new Error(
          "FrameSolver currently supports Beam+Column systems only.",
        );
      }
      if (member.Ecoef <= 0 || member.Icoef <= 0) {
        throw new Error(
          `Invalid stiffness on member ${member.startNode.id}${member.endNode.id}. E and I must be > 0.`,
        );
      }
    }
  }

  private nodeResistsAxis(node: Node, axis: "x" | "y") {
    if (!node.support) return false;
    if (axis === "x") {
      return node.support.type === "fixed" || node.support.type === "pinned";
    }
    return true; // fixed/pinned/roller resist vertical
  }

  get nodes(): Node[] {
    return [...new Set(this.members.flatMap((m) => [m.startNode, m.endNode]))];
  }

  get supports(): (PinnedSupport | RollerSupport | FixedSupport)[] {
    return this.nodes
      .map((node) => node.support)
      .filter(
        (support): support is PinnedSupport | RollerSupport | FixedSupport =>
          support != null,
      );
  }

  isSideSwaySusceptible(): boolean {
    const j = this.nodes.length;
    const f = this.supports.filter((s) => s.type === "fixed").length;
    const h = this.supports.filter((s) => s.type === "pinned").length;
    const r = this.supports.filter((s) => s.type === "roller").length;
    const m = this.members.length;

    // Classical kinematic side-sway indicator used for quick classification.
    // ss > 0 suggests additional translational DOF(s) beyond pure joint rotations.
    const ss = 2 * j - (2 * (f + h) + r + m);
    const hasHorizontalRestraint = this.supports.some(
      (s) => s.type === "fixed" || s.type === "pinned",
    );

    // If no support resists global x, frame must be sway.
    if (!hasHorizontalRestraint) return true;
    return ss > 0;
  }

  /**
   * Effective sway check for the current loading/model:
   * - false => no active lateral translation unknown, or solved DELTA ~= 0
   * - true  => solved DELTA is non-zero
   *
   * This differs from pure geometric susceptibility; use
   * `isSideSwaySusceptible()` for kinematic classification only.
   */
  isSideSway(tolerance: number = 1e-9): boolean {
    this.validateModel();
    const equations = this.updatedGetEquations();
    const deltaVars = Array.from(
      new Set(
        equations.flatMap((eq) =>
          Object.keys(eq).filter((k) => k.startsWith("DELTA_")),
        ),
      ),
    );

    if (deltaVars.length === 0) return false;

    const sol = this.equation.solveEquations(equations, {
      allowLeastSquares: true,
    });

    return deltaVars.some((name) => Math.abs(sol[name] ?? 0) > tolerance);
  }

  updatedGetSupportMoments() {
    // Prepare per-node/group DOF mapping and displacement compatibility first.
    this.slopeDeflection.configureModel(this.nodes, this.members);
    // Returns symbolic end-moment term maps (not yet numerically evaluated).
    return this.nodes.map((node) =>
      this.slopeDeflection.updatedSupportEquation(node),
    );
  }

  updatedGetEquations() {
    // Rebuild DOF/group mapping before equation assembly to keep state coherent.
    this.slopeDeflection.configureModel(this.nodes, this.members);

    // Mode-dispatched equation assembly keeps sway and non-sway workflows
    // explicit and separated while preserving one slope-deflection kernel.
    const mode: FrameAnalysisMode = resolveFrameAnalysisMode(
      this.isSideSwaySusceptible(),
    );

    this.log(`Frame equation mode: ${mode}`);

    if (mode === "sway") {
      return assembleSwayEquations(
        this.nodes,
        this.members,
        this.slopeDeflection,
      );
    }

    return assembleNonSwayEquations(this.nodes, this.slopeDeflection);
  }

  updatedGetFinalMoments() {
    // 1) Build symbolic member-end moments.
    const supportMoments = this.updatedGetSupportMoments();
    // 2) Build and solve simultaneous equations for THETA_*/DELTA_* unknowns.
    const equations = this.updatedGetEquations();
    const simSoln = this.equation.solveEquations(equations);

    // 3) Substitute solved unknowns into each symbolic end-moment expression.
    return supportMoments.reduce(
      (acc, eqn) => {
        const clk = Object.fromEntries(
          Object.entries(eqn.clk).map(([momentKey, terms]) => {
            const sum = terms.reduce((a, { name, coefficient }) => {
              const value = name === "c" ? 1 : (simSoln[name] ?? 0);
              return a + coefficient * value;
            }, 0);
            return [momentKey, sum];
          }),
        );

        const antiClk = Object.fromEntries(
          Object.entries(eqn.antiClk).map(([momentKey, terms]) => {
            const sum = terms.reduce((a, { name, coefficient }) => {
              const value = name === "c" ? 1 : (simSoln[name] ?? 0);
              return a + coefficient * value;
            }, 0);
            return [momentKey, sum];
          }),
        );

        Object.entries({ ...clk, ...antiClk }).forEach(([key, value]) => {
          acc[key] = (acc[key] ?? 0) + value;
        });

        return acc;
      },
      {} as Record<string, number>,
    );
  }

  private computeBeamShear(member: Beam, moments: Record<string, number>) {
    const loads = member.getEquivalentPointLoads();
    const L = member.length;
    // Keep beam vertical shears invariant to member draw direction in global coordinates.
    const orientationSign = member.endNode.x >= member.startNode.x ? 1 : -1;

    const Mstart =
      moments[`MOMENT${member.startNode.id}${member.endNode.id}`] ?? 0;
    const Mend =
      moments[`MOMENT${member.endNode.id}${member.startNode.id}`] ?? 0;

    const loadMoments = loads.reduce((sum, load) => {
      return sum + load.magnitude * load.position;
    }, 0);

    const RyEndRaw = (loadMoments - Mend - Mstart) / L;
    const totalLoad = loads.reduce((s, l) => s + l.magnitude, 0);
    const RyStartRaw = totalLoad - RyEndRaw;

    return {
      RyStart: RyStartRaw * orientationSign,
      RyEnd: RyEndRaw * orientationSign,
    };
  }

  private computeColumnShear(member: Column, moments: Record<string, number>) {
    const loads = member.getEquivalentPointLoads();
    const L = member.length;
    // Keep column horizontal shears invariant to member draw direction.
    const orientationSign = member.endNode.y >= member.startNode.y ? 1 : -1;

    const Mstart =
      moments[`MOMENT${member.startNode.id}${member.endNode.id}`] ?? 0;
    const Mend =
      moments[`MOMENT${member.endNode.id}${member.startNode.id}`] ?? 0;

    const loadMoments = loads.reduce((sum, load) => {
      return sum + load.magnitude * load.position;
    }, 0);

    const RxEndRaw = (loadMoments - Mend - Mstart) / L;
    const totalLoad = loads.reduce((s, l) => s + l.magnitude, 0);
    const RxStartRaw = totalLoad - RxEndRaw;

    return {
      RxStart: RxStartRaw * orientationSign,
      RxEnd: RxEndRaw * orientationSign,
    };
  }

  private solveAxialBalance(axis: "x" | "y") {
    const targetMembers = this.members.filter((m) =>
      axis === "x" ? m instanceof Beam : m instanceof Column,
    ) as (Beam | Column)[];
    if (!targetMembers.length) return;

    const memberVar = new Map<Beam | Column, string>();
    for (const member of targetMembers) {
      memberVar.set(
        member,
        `N_${member.startNode.id}${member.endNode.id}_${axis}`,
      );
    }

    const equations: Record<string, number>[] = [];
    for (const node of this.nodes) {
      if (this.nodeResistsAxis(node, axis)) continue;

      const eq: Record<string, number> = {};
      for (const conn of node.connectedMembers) {
        const member = conn.member;
        if (
          (axis === "x" && !(member instanceof Beam)) ||
          (axis === "y" && !(member instanceof Column))
        ) {
          continue;
        }

        const key = memberVar.get(member as Beam | Column);
        if (!key) continue;

        const sign = member.startNode === node ? 1 : -1;
        eq[key] = (eq[key] ?? 0) + sign;
      }

      if (Object.keys(eq).length === 0) continue;
      eq.c = axis === "x" ? node.xReaction : node.yReaction;
      equations.push(eq);
    }

    if (!equations.length) return;

    const sol = this.equation.solveEquations(equations, {
      allowLeastSquares: true,
    });

    for (const member of targetMembers) {
      const key = memberVar.get(member)!;
      const n = sol[key] ?? 0;

      if (axis === "x" && member instanceof Beam) {
        member.endReactions.RxStart += n;
        member.endReactions.RxEnd += -n;
        member.startNode.xReaction += n;
        member.endNode.xReaction += -n;
      } else if (axis === "y" && member instanceof Column) {
        member.endReactions.RyStart += n;
        member.endReactions.RyEnd += -n;
        member.startNode.yReaction += n;
        member.endNode.yReaction += -n;
      }
    }
  }

  updatedSolveReactions() {
    this.validateModel();
    // End moments are solved first (slope-deflection stage).
    const moments = this.updatedGetFinalMoments();

    for (const node of this.nodes) {
      node.xReaction = -node.xLoad;
      node.yReaction = -node.yLoad;
    }
    for (const m of this.members) {
      m.endReactions = { RxStart: 0, RyStart: 0, RxEnd: 0, RyEnd: 0 };
    }

    for (const member of this.members) {
      if (member instanceof Beam) {
        // Beam shear from end moments + vertical member loads.
        const { RyStart, RyEnd } = this.computeBeamShear(member, moments);
        member.endReactions.RyStart = RyStart;
        member.endReactions.RyEnd = RyEnd;
        member.startNode.yReaction += RyStart;
        member.endNode.yReaction += RyEnd;
        this.log(
          `Beam ${member.startNode.id}${member.endNode.id}: RyStart=${RyStart.toFixed(3)}, RyEnd=${RyEnd.toFixed(3)}`,
        );
      } else if (member instanceof Column) {
        // Column horizontal shear from end moments + horizontal member loads.
        const { RxStart, RxEnd } = this.computeColumnShear(member, moments);
        member.endReactions.RxStart = RxStart;
        member.endReactions.RxEnd = RxEnd;
        member.startNode.xReaction += RxStart;
        member.endNode.xReaction += RxEnd;
        this.log(
          `Col ${member.startNode.id}${member.endNode.id}: RxStart=${RxStart.toFixed(3)}, RxEnd=${RxEnd.toFixed(3)}`,
        );
      }
    }

    // Secondary balancing step:
    // - axis x: distribute beam axial forces needed by node x-equilibrium.
    // - axis y: distribute column axial forces needed by node y-equilibrium.
    this.solveAxialBalance("x");
    this.solveAxialBalance("y");

    const results = new Map<string, { xReaction: number; yReaction: number }>();
    for (const node of this.nodes.filter((n) => !!n.support)) {
      let xReaction = -node.xLoad;
      let yReaction = -node.yLoad;

      for (const conn of node.connectedMembers) {
        const m = conn.member;
        if (conn.isStart) {
          xReaction += m.endReactions.RxStart;
          yReaction += m.endReactions.RyStart;
        } else {
          xReaction += m.endReactions.RxEnd;
          yReaction += m.endReactions.RyEnd;
        }
      }

      // Roller does not provide horizontal restraint.
      if (node.support?.type === "roller") {
        xReaction = 0;
      }

      results.set(node.id, {
        xReaction,
        yReaction,
      });
    }
    return results;
  }
}
