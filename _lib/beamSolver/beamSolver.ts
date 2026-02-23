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

export type BeamNodeMoment = {
  nodeId: string;
  leftMoment: number;
  rightMoment: number;
};

export type BeamSupportReaction = {
  xReaction: number;
  yReaction: number;
  momentReaction: number;
};

export type BeamInternalForcePoint = {
  x: number;
  shear: number;
  moment: number;
  axial: number;
};

type MemberEndReactions = {
  leftReaction: number;
  rightReaction: number;
};

export class BeamSolver {
  beams: Beam[];
  FEM: FixedEndMoments;
  slopeDeflection: SlopeDeflection;
  equation: Equation;

  constructor(beams: Beam[] = []) {
    this.beams = beams;
    this.FEM = new FixedEndMoments();
    this.slopeDeflection = new SlopeDeflection();
    this.equation = new Equation();
  }

  get nodes(): Node[] {
    return [...new Set(this.beams.flatMap((b) => [b.startNode, b.endNode]))];
  }

  /** Get all unique supports in the system */
  getSupports() {
    const supports = this.beams.flatMap((beam) => [
      beam.startNode.support ?? null,
      beam.endNode.support ?? null,
    ]);
    return Array.from(new Set(supports.filter((s) => s !== null))) as (
      | FixedSupport
      | RollerSupport
      | PinnedSupport
    )[];
  }

  updatedGetSupportMoments() {
    return this.nodes.map((node) =>
      this.slopeDeflection.updatedSupportEquation(node),
    );
  }

  /** Solve simultaneous equations for non-fixed supports */
  updatedGetEquations() {
    return this.nodes
      .filter((s) => s.support?.type !== "fixed")
      .map((s) => this.slopeDeflection.updatedGetEquations(s));
  }

  private momentResultMap(values: BeamNodeMoment[]) {
    return new Map(values.map((v) => [v.nodeId, v]));
  }

  /** Solve for final moments at nodes (anti-clockwise positive). */
  updatedGetFinalMoments(): BeamNodeMoment[] {
    const supportMoments = this.updatedGetSupportMoments();
    const equations = this.updatedGetEquations();
    const simSoln = this.equation.solveEquations(equations, {
      allowLeastSquares: true,
    });

    return supportMoments.map((supportEqn, index) => {
      const node = this.nodes[index];

      const leftMomentTerms = Object.values(supportEqn.clk).flat();
      const leftMoment = leftMomentTerms.reduce((acc, term) => {
        const key = term.name === "EIdeta" ? "c" : term.name;
        const value = key === "c" ? 1 : (simSoln[key] ?? 0);
        return acc + term.coefficient * value;
      }, 0);

      const rightMomentTerms = Object.values(supportEqn.antiClk).flat();
      const rightMoment = rightMomentTerms.reduce((acc, term) => {
        const key = term.name === "EIdeta" ? "c" : term.name;
        const value = key === "c" ? 1 : (simSoln[key] ?? 0);
        return acc + term.coefficient * value;
      }, 0);

      if (node.support) {
        node.support.leftMoment = leftMoment;
        node.support.rightMoment = rightMoment;
      }

      return { nodeId: node.id, leftMoment, rightMoment };
    });
  }

  private getMemberEndMoments(
    member: Beam | Column | InclinedMember,
    momentsByNode: Map<string, BeamNodeMoment>,
  ) {
    const startMoments = momentsByNode.get(member.startNode.id);
    const endMoments = momentsByNode.get(member.endNode.id);
    return {
      leftMoment: startMoments?.rightMoment ?? 0,
      rightMoment: endMoments?.leftMoment ?? 0,
    };
  }

  private memberEndReactions(
    member: Beam | Column | InclinedMember,
    momentsByNode: Map<string, BeamNodeMoment>,
  ): MemberEndReactions {
    const loads = member.getEquivalentPointLoads();
    const L = member.length;
    const { leftMoment, rightMoment } = this.getMemberEndMoments(
      member,
      momentsByNode,
    );

    const totalLoads = loads.reduce((acc, curr) => acc + curr.magnitude, 0);

    let leftReaction = 0;
    let rightReaction = 0;

    if (member.startNode.support && member.endNode.support) {
      const loadMoments = loads.reduce(
        (acc, curr) => acc + curr.magnitude * curr.position,
        0,
      );
      rightReaction = (loadMoments - leftMoment - rightMoment) / L;
      leftReaction = totalLoads - rightReaction;
    } else if (member.startNode.support && !member.endNode.support) {
      leftReaction = totalLoads;
    } else if (!member.startNode.support && member.endNode.support) {
      rightReaction = totalLoads;
    }

    return { leftReaction, rightReaction };
  }

  updatedSolveReactions(member: Beam | Column | InclinedMember) {
    const momentsByNode = this.momentResultMap(this.updatedGetFinalMoments());
    return this.memberEndReactions(member, momentsByNode);
  }

  /**
   * Returns nodal support reactions with sign conventions:
   * - Upward force is positive.
   * - Anti-clockwise moment is positive.
   */
  updatedGetSupportReactions(): Record<string, BeamSupportReaction> {
    const nodes = this.nodes;
    const momentsByNode = this.momentResultMap(this.updatedGetFinalMoments());

    const result: Record<string, BeamSupportReaction> = {};

    nodes
      .filter((node): node is Node => node.support !== null)
      .forEach((node) => {
        const support = node.support;
        if (!support) return;

        let xReaction = -node.xLoad;
        let yReaction = node.yLoad;
        let momentReaction = 0;

        for (const conn of node.connectedMembers) {
          const memberReactions = this.memberEndReactions(
            conn.member,
            momentsByNode,
          );
          if (conn.isStart) {
            yReaction += memberReactions.leftReaction;
          } else {
            yReaction += memberReactions.rightReaction;
          }
        }

        // Anti-clockwise support reaction moment is positive.
        if (support.type === "fixed") {
          const supportMoment = support.leftMoment + support.rightMoment;
          momentReaction = supportMoment + node.momentLoad;
        }

        result[`SUPPORT${support.id}`] = {
          xReaction,
          yReaction,
          momentReaction,
        };
      });

    return result;
  }

  private accumulatedLoadResultants(member: Beam, x: number) {
    let totalLoad = 0;
    let totalMomentAboutSection = 0;

    for (const load of member.loads) {
      if (load.name === "PointLoad") {
        if (load.position <= x) {
          totalLoad += load.magnitude;
          totalMomentAboutSection += load.magnitude * (x - load.position);
        }
      } else if (load.name === "UDL") {
        const loadStart = load.startPosition;
        const loadEnd = load.startPosition + load.span;
        if (loadStart < x) {
          const activeEnd = Math.min(loadEnd, x);
          const activeSpan = activeEnd - loadStart;
          if (activeSpan > 0) {
            const resultant = activeSpan * load.magnitudePerMeter;
            const centroid = loadStart + activeSpan / 2;
            totalLoad += resultant;
            totalMomentAboutSection += resultant * (x - centroid);
          }
        }
      } else if (load.name === "VDL") {
        // For now, only include full VDL that lies to the left of the section.
        // This matches the current solver approximation.
        if (load.highPosition <= x && load.lowPosition <= x) {
          const resultant = load.getResultantLoad();
          totalLoad += resultant.magnitude;
          totalMomentAboutSection +=
            resultant.magnitude * (x - resultant.position);
        }
      }
    }

    return { totalLoad, totalMomentAboutSection };
  }

  /** Internal shear V(x), with upward positive sign convention. */
  getInternalShear(member: Beam, x: number): number {
    const momentsByNode = this.momentResultMap(this.updatedGetFinalMoments());
    const endReactions = this.memberEndReactions(member, momentsByNode);
    const applied = this.accumulatedLoadResultants(member, x);
    return endReactions.leftReaction - applied.totalLoad;
  }

  /**
   * Internal bending moment M(x), anti-clockwise positive.
   * Sagging/hogging interpretation depends on your section sign convention.
   */
  getInternalMoment(member: Beam, x: number): number {
    const momentsByNode = this.momentResultMap(this.updatedGetFinalMoments());
    const endReactions = this.memberEndReactions(member, momentsByNode);
    const endMoments = this.getMemberEndMoments(member, momentsByNode);
    const applied = this.accumulatedLoadResultants(member, x);

    return (
      endReactions.leftReaction * x -
      endMoments.leftMoment -
      applied.totalMomentAboutSection
    );
  }

  /** Beam internal force data from solver-native statics at section cuts. */
  getInternalForceData(
    member: Beam,
    step: number = 0.1,
  ): BeamInternalForcePoint[] {
    const points: number[] = [];
    for (let x = 0; x <= member.length; x += step) {
      points.push(x);
    }
    if (Math.abs(points[points.length - 1] - member.length) > 1e-6) {
      points.push(member.length);
    }

    return points.map((x) => ({
      x,
      shear: this.getInternalShear(member, x),
      moment: this.getInternalMoment(member, x),
      axial: 0,
    }));
  }

  getAllBeamInternalForceData(step: number = 0.1) {
    return this.beams.map((beam) => ({
      beam: `Beam ${beam.startNode.id}-${beam.endNode.id}`,
      data: this.getInternalForceData(beam, step),
    }));
  }

  /**
   * Calculates maximum positive and negative moments for each beam span.
   * @param step step size in member local length units
   */
  getMaxMomentPerSpan(step: number = 0.1) {
    return this.beams.map((beam) => {
      const data = this.getInternalForceData(beam, step);
      let maxPositive = -Infinity;
      let maxNegative = Infinity;

      for (const point of data) {
        if (point.moment > maxPositive) maxPositive = point.moment;
        if (point.moment < maxNegative) maxNegative = point.moment;
      }

      return {
        beam: `Beam ${beam.startNode.id}-${beam.endNode.id}`,
        maxPositiveMoment: maxPositive,
        maxNegativeMoment: maxNegative,
      };
    });
  }
}
