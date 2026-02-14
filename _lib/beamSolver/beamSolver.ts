// output.ts

import { Beam, Column, InclinedMember } from "../elements/member";
import {
  FixedSupport,
  PinnedSupport,
  RollerSupport,
} from "../elements/support";
import { FixedEndMoments } from "../logic/FEMs";
import { SlopeDeflection } from "./slopeDeflectionEqn";
import { Equation } from "../logic/simultaneousEqn";
import { PointLoad, UDL, VDL } from "../elements/load";
import { Node } from "../elements/node";

// --- CONSTANTS ---
const supportB = new FixedSupport(16, 0);
const supportC = new FixedSupport(28, 0);

const nodeB = new Node("B", supportB.x, 0, supportB);
const nodeC = new Node("C", supportC.x, 0, supportC);

const BC = new Beam(nodeB, nodeC);

BC.addLoad(new UDL(0, 12, 3));
// BC.addLoad(new VDL(24, 4, 0, 8));

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
    return this.nodes.map((node) => {
      return this.slopeDeflection.updatedSupportEquation(node);
    });
  }

  /** Solve simultaneous equations for non-fixed supports */
  updatedGetEquations() {
    return this.nodes
      .filter((s) => s.support?.type !== "fixed")
      .map((s) => this.slopeDeflection.updatedGetEquations(s));
  }

  /** Solve for final moments at supports */
  updatedGetFinalMoments() {
    const supportMoments = this.updatedGetSupportMoments();
    const equations = this.updatedGetEquations();
    const simulEqnSoln = this.equation.solveEquations(equations, {
      allowLeastSquares: true,
    });

    console.dir(supportMoments, { depth: Infinity });

    const momentValues = supportMoments.map((supportEqn, index) => {
      const leftMomentTerms = Object.values(supportEqn.clk).flat();
      const leftMomentValue = leftMomentTerms.reduce((acc, term) => {
        const key = term.name === "EIdeta" ? "c" : term.name;
        const value = key === "c" ? 1 : (simulEqnSoln[key] ?? 0);
        return acc + term.coefficient * value;
      }, 0);

      const rightMomentTerms = Object.values(supportEqn.antiClk).flat();
      const rightMomentValue = rightMomentTerms.reduce((acc, term) => {
        const key = term.name === "EIdeta" ? "c" : term.name;
        const value = key === "c" ? 1 : (simulEqnSoln[key] ?? 0);
        return acc + term.coefficient * value;
      }, 0);

      // assign the left and right moments for each supports here
      const supports = this.getSupports();
      const support = supports[index];
      if (support) {
        support.leftMoment = leftMomentValue;
        support.rightMoment = rightMomentValue;
      }

      return { leftMoment: leftMomentValue, rightMoment: rightMomentValue };
    });

    return momentValues;
  }

  updatedSolveReactions(member: Beam | Column | InclinedMember) {
    const loads = member.getEquivalentPointLoads();
    const L = member.length;
    const startNode = member.startNode;
    const endNode = member.endNode;
    const leftMoment = startNode.support?.rightMoment ?? 0;
    const rightMoment = endNode.support?.leftMoment ?? 0;

    const totalLoads = loads.reduce((acc: number, curr: PointLoad) => {
      return acc + curr.magnitude;
    }, 0);

    let leftReaction = 0;
    let rightReaction = 0;

    if (startNode.support && endNode.support) {
      const loadMoments = loads.reduce((acc: number, curr: PointLoad) => {
        const distance = curr.position;
        const moment = curr.magnitude * distance;

        return acc + moment;
      }, 0);

      rightReaction = (loadMoments - leftMoment - rightMoment) / L;

      leftReaction = totalLoads - rightReaction;
    } else {
      if (startNode.support && !endNode.support) {
        leftReaction = totalLoads;
      } else if (!startNode.support && endNode.support) {
        rightReaction = totalLoads;
      }
    }
    return { leftReaction, rightReaction };
  }

  updatedGetSupportReactions() {
    // const supports = this.getSupports();
    const nodes = this.nodes;

    const result: Record<string, number> = {};

    nodes
      .filter((node): node is Node => node.support !== null)
      .forEach((node) => {
        // LEFT
        let reaction = 0;

        for (const member of node.connectedMembers) {
          if (!member.isStart) {
            const result =
              this.updatedSolveReactions(member.member)?.rightReaction ?? 0;
            reaction += result;
          } else {
            const result =
              this.updatedSolveReactions(member.member)?.leftReaction ?? 0;
            reaction += result;
          }
        }

        result[`SUPPORT${node.support?.id}`] = reaction;
      });
    return result;
  }

  /**
   * Calculates the internal moment at a specific distance x from the start of the beam.
   * Assumes x is within [0, member.length].
   * Sign Convention:
   * - Sagging (Bottom Tension) is POSITIVE (+).
   * - Hogging (Top Tension) is NEGATIVE (-).
   *
   * Method of Sections at distance x:
   * Take moments about the cut section x, considering forces to the left.
   * M(x) = (R_L * x) - (Moment of Support Reaction Force) - (Sum of Load Moments)
   *
   * Handling Support Moment (M_L):
   * - Solver outputs "Left Moment" (M_L) as the moment acting on the member start.
   * - FEM Convention: Anti-Clockwise is Positive (+).
   * - Physical Bending: An Anti-Clockwise moment at the left end causes Hogging (Upward curl).
   * - Therefore, Hogging = Negative Moment.
   * - So contribution of M_L to internal moment is: -1 * M_L.
   */
  getInternalMoment(member: Beam, x: number): number {
    const reactions = this.updatedSolveReactions(member);
    const leftReaction = reactions.leftReaction;

    // M_L is the moment at the start node (e.g. from Fixed support or continuity).
    // In Slope Deflection / FEM logic here: Anti-Clockwise is Positive.
    // An ACW moment at the left end creates tension at the top (Hogging).
    // Thus, it contributes negatively to our Sagging-Positive convention.
    const startNode = member.startNode;
    const M_L = startNode.support?.rightMoment ?? 0;

    // Base Calculation: Reaction * Distance - Support Moment
    let moment = leftReaction * x - M_L;

    // Subtract Moments from Loads to the left of x
    for (const load of member.loads) {
      if (load.name === "PointLoad") {
        if (load.position < x) {
          moment -= load.magnitude * (x - load.position);
        }
      } else if (load.name === "UDL") {
        // UDL(start, span, mag)
        const loadStart = load.startPosition;
        const loadEnd = load.startPosition + load.span;

        // If the load starts after x, it doesn't affect the moment at x
        if (loadStart < x) {
          // The portion of the UDL that is to the left of x
          const activeEnd = Math.min(loadEnd, x);
          const activeSpan = activeEnd - loadStart;
          const activeMag = activeSpan * load.magnitudePerMeter;

          // Distance from centroid of the active load portion to x
          // Centroid is at loadStart + activeSpan/2
          // Distance = x - (loadStart + activeSpan / 2)
          const centroidDist = x - (loadStart + activeSpan / 2);

          moment -= activeMag * centroidDist;
        }
      } else if (load.name === "VDL") {
        // VDL logic is complex for partial spans.
        // For now, if x covers the entire VDL, we treat it as a resultant point load.
        // If x cuts the VDL, we need integration.
        // Skipping precise cut-VDL logic for now to avoid complexity unless requested.
        // Falls back to approximation if fully to the left.

        if (load.highPosition <= x && load.lowPosition <= x) {
          const resultant = load.getResultantLoad();
          moment -= resultant.magnitude * (x - resultant.position);
        }
      }
    }

    return moment;
  }

  /**
   * Calculates the maximum sagging (+) and hogging (-) moments for each beam span.
   * @param step Step size for iteration in meters (default 0.1)
   */
  getMaxMomentPerSpan(step: number = 0.1) {
    // Ensure we solve for moments and reactions first
    // Note: updatedGetFinalMoments modifies the supports in-place with moments
    this.updatedGetFinalMoments();

    return this.beams.map((beam) => {
      let maxSagging = -Infinity;
      let maxHogging = Infinity;

      // Iteration points including ends
      const points: number[] = [];
      for (let x = 0; x <= beam.length; x += step) {
        points.push(x);
      }
      if (Math.abs(points[points.length - 1] - beam.length) > 1e-6) {
        points.push(beam.length);
      }

      for (const x of points) {
        const m = this.getInternalMoment(beam, x);
        if (m > maxSagging) maxSagging = m;
        if (m < maxHogging) maxHogging = m;
      }

      // Logic check: if maxSagging is still negative, then no sagging occurred (all hogging) -> 0
      if (maxSagging < 0) maxSagging = 0;
      // if maxHogging is still positive, then no hogging occurred -> 0
      if (maxHogging > 0) maxHogging = 0;

      return {
        beam: `Beam ${beam.startNode.id}-${beam.endNode.id}`,
        maxSagging, // Positive (kNm)
        maxHogging, // Negative (kNm)
      };
    });
  }
}

const output = new BeamSolver([BC]);
console.log(output.updatedGetFinalMoments());

console.log(output.updatedGetSupportReactions());

output.updatedGetFinalMoments();
