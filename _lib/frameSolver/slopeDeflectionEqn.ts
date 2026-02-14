import { Node } from "../elements/node";
import { Beam, Column, InclinedMember } from "../elements/member";
import { FixedEndMoments } from "../logic/FEMs";
import { Equation } from "../logic/simultaneousEqn";

/**
 * Developer Guide (Frame Slope-Deflection Core)
 *
 * Unknowns used by this file:
 * - THETA_<nodeId>: joint rotation unknowns.
 * - DELTA_<groupId>: sway translation unknowns (one per free sway group).
 *
 * Equation pipeline:
 * 1) configureModel(...)
 *    - Builds beam-connected node groups and assigns DELTA variables where
 *      there is no horizontal restraint (fixed/pinned support).
 *
 * 2) getEndMomentTerms(member, node)
 *    - Builds each member-end moment expression in symbolic "Term[]" form:
 *      c + a*THETA_i + b*THETA_j + d*DELTA_k
 *    - Includes settlement/translation contribution from imposed nodal
 *      displacements (global dx, dy) and support settlement.
 *    - Includes sway contribution for columns.
 *    - Handles free-end members (cantilever/overhang) with M_free = 0 and
 *      near-end load moment by statics.
 *
 * 3) updatedGetEquations(node)
 *    - Sums all end moments at a non-fixed joint -> joint equilibrium
 *      equation (sum M at joint = 0), including nodal moment load.
 *
 * 4) getSwayEquations(...)
 *    - For each DELTA group, sums column end shears and nodal horizontal
 *      loads to create translational equilibrium equations.
 *
 * 5) FrameSolver combines joint + sway equations and solves simultaneously,
 *    then substitutes solved unknowns back into end-moment expressions.
 */
type Term = { name: string; coefficient: number };
type EndMomentMap = { [momentKey: string]: Term[] };

type SwayGroup = {
  nodes: Node[];
  varName: string | null;
};

function isBeamOrColumn(
  member: Beam | Column | InclinedMember,
): member is Beam | Column {
  return member instanceof Beam || member instanceof Column;
}

export class SlopeDeflection {
  private fem = new FixedEndMoments();
  private eqSolver = new Equation();
  private nodeToSwayVar = new Map<Node, string | null>();
  private swayGroups: SwayGroup[] = [];
  private compatibleDisp = new Map<Node, { dx: number; dy: number }>();

  configureModel(nodes: Node[], members: (Beam | Column | InclinedMember)[]) {
    this.nodeToSwayVar.clear();
    this.swayGroups = [];
    this.compatibleDisp.clear();

    const beamAdj = new Map<Node, Node[]>();
    for (const node of nodes) beamAdj.set(node, []);

    for (const member of members) {
      if (!(member instanceof Beam)) continue;
      beamAdj.get(member.startNode)?.push(member.endNode);
      beamAdj.get(member.endNode)?.push(member.startNode);
    }

    const visited = new Set<Node>();
    let freeGroupIndex = 1;

    for (const seed of nodes) {
      if (visited.has(seed)) continue;

      const queue: Node[] = [seed];
      visited.add(seed);
      const component: Node[] = [];

      while (queue.length > 0) {
        const cur = queue.shift()!;
        component.push(cur);
        for (const nxt of beamAdj.get(cur) ?? []) {
          if (visited.has(nxt)) continue;
          visited.add(nxt);
          queue.push(nxt);
        }
      }

      const restrained = component.some(
        (n) => n.support?.type === "fixed" || n.support?.type === "pinned",
      );
      const varName = restrained ? null : `DELTA_${freeGroupIndex++}`;

      this.swayGroups.push({ nodes: component, varName });
      for (const node of component) this.nodeToSwayVar.set(node, varName);
    }

    this.resolveCompatibleNodalDisplacements(nodes, members);
  }

  private uxVar(node: Node) {
    return `UX_${node.id}`;
  }

  private uyVar(node: Node) {
    return `UY_${node.id}`;
  }

  private resolveCompatibleNodalDisplacements(
    nodes: Node[],
    members: (Beam | Column | InclinedMember)[],
  ) {
    const tol = 1e-12;
    const known: Record<string, number> = {};
    const equations: Record<string, number>[] = [];

    const setKnown = (key: string, value: number) => {
      known[key] = value;
    };

    for (const node of nodes) {
      const ux = this.uxVar(node);
      const uy = this.uyVar(node);
      const imposedX = node.imposedDx ?? 0;
      const imposedY = (node.imposedDy ?? 0) + (node.support?.settlement ?? 0);

      if (node.support?.type === "fixed" || node.support?.type === "pinned") {
        setKnown(ux, imposedX);
        setKnown(uy, imposedY);
        continue;
      }

      if (node.support?.type === "roller") {
        setKnown(uy, imposedY);
        if (Math.abs(imposedX) > tol) setKnown(ux, imposedX);
        continue;
      }

      if (Math.abs(imposedX) > tol) setKnown(ux, imposedX);
      if (Math.abs(imposedY) > tol) setKnown(uy, imposedY);
    }

    for (const member of members) {
      if (!isBeamOrColumn(member)) continue;
      const L = member.length;
      if (L <= tol) continue;

      const c = (member.endNode.x - member.startNode.x) / L;
      const s = (member.endNode.y - member.startNode.y) / L;

      const eq: Record<string, number> = {};
      let cst = 0;
      const addTerm = (key: string, coeff: number) => {
        if (!coeff) return;
        if (key in known) {
          cst += coeff * known[key];
        } else {
          eq[key] = (eq[key] ?? 0) + coeff;
        }
      };

      addTerm(this.uxVar(member.endNode), c);
      addTerm(this.uyVar(member.endNode), s);
      addTerm(this.uxVar(member.startNode), -c);
      addTerm(this.uyVar(member.startNode), -s);

      const hasUnknown = Object.keys(eq).length > 0;
      if (!hasUnknown) {
        if (Math.abs(cst) > 1e-9) {
          throw new Error(
            "Incompatible imposed displacements/support settlements under axial-rigid compatibility.",
          );
        }
        continue;
      }

      if (Math.abs(cst) > tol) eq.c = cst;
      equations.push(eq);
    }

    const sol =
      equations.length > 0
        ? this.eqSolver.solveEquations(equations, { allowLeastSquares: true })
        : {};

    for (const node of nodes) {
      const dx = known[this.uxVar(node)] ?? sol[this.uxVar(node)] ?? 0;
      const dy = known[this.uyVar(node)] ?? sol[this.uyVar(node)] ?? 0;
      this.compatibleDisp.set(node, { dx, dy });
    }
  }

  private thetaName(node: Node) {
    return `THETA_${node.id}`;
  }

  private swayVar(node: Node) {
    return this.nodeToSwayVar.get(node) ?? null;
  }

  private isTerminalNode(node: Node) {
    const n = node.connectedMembers.filter((c) => isBeamOrColumn(c.member)).length;
    return n <= 1;
  }

  private isFreeNode(node: Node) {
    return this.isTerminalNode(node) && !node.support;
  }

  private loadMomentAboutNode(member: Beam | Column, node: Node) {
    let sum = 0;
    for (const load of member.getEquivalentPointLoads()) {
      if (member.startNode === node) {
        sum += load.magnitude * (0 - load.position);
      } else if (member.endNode === node) {
        sum += load.magnitude * (member.length - load.position);
      }
    }
    return -sum;
  }

  private isFixed(node: Node) {
    return node.support?.type === "fixed";
  }

  private getMemberFactors(member: Beam | Column) {
    const L = member.length;
    const EI = member.Ecoef * member.Icoef;
    const k = (2 * EI) / L;
    return { L, EI, k };
  }

  private scaleTerms(terms: Term[], factor: number) {
    return terms.map((t) => ({ name: t.name, coefficient: t.coefficient * factor }));
  }

  private getNodeImposedDisplacement(node: Node) {
    return (
      this.compatibleDisp.get(node) ?? {
        dx: node.imposedDx ?? 0,
        dy: (node.imposedDy ?? 0) + (node.support?.settlement ?? 0),
      }
    );
  }

  private getMemberSettlementConstant(member: Beam | Column) {
    const { L, EI } = this.getMemberFactors(member);
    const us = this.getNodeImposedDisplacement(member.startNode);
    const ue = this.getNodeImposedDisplacement(member.endNode);

    // Local transverse unit vector n = [-sin(theta), cos(theta)].
    const nX = -Math.sin(member.angle);
    const nY = Math.cos(member.angle);

    // Relative displacement projected on local transverse direction.
    const duX = ue.dx - us.dx;
    const duY = ue.dy - us.dy;
    const deltaTransverse = duX * nX + duY * nY;

    return (6 * EI * deltaTransverse) / (L * L);
  }

  private getColumnSwayTerms(member: Column): Term[] {
    const { L, EI } = this.getMemberFactors(member);
    const coeff = (6 * EI) / (L * L);

    const startVar = this.swayVar(member.startNode);
    const endVar = this.swayVar(member.endNode);

    const terms: Term[] = [];
    // Use the same chord-rotation reference at both member ends.
    // This avoids artificial DELTA cancellation in symmetric sway frames.
    if (startVar) terms.push({ name: startVar, coefficient: coeff });
    if (endVar) terms.push({ name: endVar, coefficient: -coeff });
    return terms;
  }

  private getEndMomentTerms(member: Beam | Column, node: Node): Term[] {
    const atStart = member.startNode === node;
    const near = atStart ? member.startNode : member.endNode;
    const far = atStart ? member.endNode : member.startNode;

    const nearFree = this.isFreeNode(near);
    const farFree = this.isFreeNode(far);
    if (nearFree && !farFree) {
      return [{ name: "c", coefficient: 0 }];
    }
    if (!nearFree && farFree) {
      return [{ name: "c", coefficient: this.loadMomentAboutNode(member, near) }];
    }

    const femConst =
      this.fem.getFixedEndMoment(member, atStart ? "start" : "end") ?? 0;
    const { k } = this.getMemberFactors(member);

    const terms: Term[] = [{ name: "c", coefficient: femConst }];

    if (!this.isFixed(near)) {
      terms.push({ name: this.thetaName(near), coefficient: 2 * k });
    }
    if (!this.isFixed(far)) {
      terms.push({ name: this.thetaName(far), coefficient: k });
    }

    const settlement = this.getMemberSettlementConstant(member);
    if (settlement) terms[0].coefficient += settlement;

    if (member instanceof Column) {
      terms.push(...this.getColumnSwayTerms(member));
    }

    return terms;
  }

  collectLikeTerms = (terms: Term[]) => {
    const eq: { [key: string]: number } = {};
    for (const term of terms) {
      if (!term.coefficient) continue;
      eq[term.name] = (eq[term.name] ?? 0) + term.coefficient;
    }
    return eq;
  };

  updatedSupportEquation(node: Node) {
    const clk: EndMomentMap = {};
    const antiClk: EndMomentMap = {};

    for (const conn of node.connectedMembers) {
      const member = conn.member;
      if (!isBeamOrColumn(member)) continue;

      const other = member.startNode === node ? member.endNode : member.startNode;
      const key = `MOMENT${node.id}${other.id}`;
      clk[key] = this.getEndMomentTerms(member, node);
    }

    return { clk, antiClk };
  }

  updatedGetEquations(node: Node) {
    const { clk, antiClk } = this.updatedSupportEquation(node);
    const terms: Term[] = [
      ...Object.values(clk).flat(),
      ...Object.values(antiClk).flat(),
    ];

    const eq = this.collectLikeTerms(terms);
    if (node.momentLoad) {
      eq.c = (eq.c ?? 0) + node.momentLoad;
    }
    return eq;
  }

  private getColumnEndShearTerms(member: Column, atNode: Node): Term[] {
    const L = member.length;
    const loads = member.getEquivalentPointLoads();
    const totalLoad = loads.reduce((s, l) => s + l.magnitude, 0);
    const loadMoments = loads.reduce((s, l) => s + l.magnitude * l.position, 0);

    const mStart = this.getEndMomentTerms(member, member.startNode);
    const mEnd = this.getEndMomentTerms(member, member.endNode);

    if (atNode === member.startNode) {
      return [
        ...this.scaleTerms(mStart, 1 / L),
        ...this.scaleTerms(mEnd, 1 / L),
        { name: "c", coefficient: totalLoad - loadMoments / L },
      ];
    }

    return [
      ...this.scaleTerms(mStart, -1 / L),
      ...this.scaleTerms(mEnd, -1 / L),
      { name: "c", coefficient: loadMoments / L },
    ];
  }

  getSwayEquations(
    _nodes: Node[],
    _members: (Beam | Column | InclinedMember)[],
  ) {
    const eqns: Record<string, number>[] = [];

    for (const group of this.swayGroups) {
      if (!group.varName) continue;

      const terms: Term[] = [];
      let groupFxLoad = 0;
      for (const node of group.nodes) {
        groupFxLoad += node.xLoad;
        for (const conn of node.connectedMembers) {
          if (!(conn.member instanceof Column)) continue;
          terms.push(...this.getColumnEndShearTerms(conn.member, node));
        }
      }

      if (!terms.length) continue;

      const eq = this.collectLikeTerms(terms);
      if (groupFxLoad) {
        eq.c = (eq.c ?? 0) - groupFxLoad;
      }
      if (Object.keys(eq).length > 0) {
        eqns.push(eq);
      }
    }

    return eqns;
  }
}
