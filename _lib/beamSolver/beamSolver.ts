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

// --- CREATE SUPPORTS ---
const supportA = new PinnedSupport(0, 0);
const supportB = new PinnedSupport(6, 0, supportA);
const supportC = new PinnedSupport(18, 0, supportB);
const supportD = new PinnedSupport(24, 0, supportC);

// --- CREATE NODES ---
const nodeA = new Node("A", supportA.x, 0, supportA);
const nodeB = new Node("B", supportB.x, 0, supportB);
const nodeC = new Node("C", supportC.x, 0, supportC);
const nodeD = new Node("D", supportD.x, 0, supportD);
const nodeE = new Node("E", 25.5, 0);

// --- CREATE BEAMS ---
// Updated to match Beam constructor: startNode, endNode, leftSupport, rightSupport
// const AB = new Beam(nodeA, nodeB, support1, support2);
// const BC = new Beam(nodeB, nodeC, support2, support3);
const AB = new Beam(nodeA, nodeB, 1, 3);
const BC = new Beam(nodeB, nodeC, 1, 10);
const CD = new Beam(nodeC, nodeD, 1, 2);
const DE = new Beam(nodeD, nodeE, 1, 2);

// --- ADD LOADS ---

AB.addLoad(new UDL(0, 6, 24));
BC.addLoad(new UDL(0, 12, 16));
BC.addLoad(new PointLoad(6, 80));
CD.addLoad(new PointLoad(2, 72));
DE.addLoad(new PointLoad(1.5, 24));

// --- LINK BEAMS TO SUPPORTS ---
// support1.rightBeam = AB;
// support2.leftBeam = AB;
// support2.rightBeam = BC;
// support3.leftBeam = BC;

// --- LINK BEAMS TO NODES ---
// nodeA.connectedMembers.push(AB);
// nodeB.connectedMembers.push(AB, BC);
// nodeC.connectedMembers.push(BC);

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
    console.log(this.beams)
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

  // getSupportMoments() {
  //   const supports = this.getSupports().filter(
  //     (s): s is FixedSupport | PinnedSupport | RollerSupport => s !== null
  //   );

  //   const supportMoments = supports.map((support) =>
  //     this.slopeDeflection.supportEquations(support)
  //   );

  //   return supportMoments;
  // }

  updatedGetSupportMoments() {
    return this.nodes.map((node) => {
      return this.slopeDeflection.updatedSupportEquation(node);
    });
  }

  /** Get slope-deflection support equations */
  // getSupportEquations() {
  //   return this.getSupports().map((support) =>
  //     this.slopeDeflection.supportEquations(support)
  //   );
  // }

  /** Solve simultaneous equations for non-fixed supports */
  // getEquations() {
  //   const supports = this.getSupports();
  //   return supports
  //     .filter((s) => s.type !== "fixed")
  //     .map((s) => this.slopeDeflection.getEquations(s));
  // }

  updatedGetEquations() {
    // const supports = this.getSupports();
    // return supports
    //   .filter((s) => s.type !== "fixed")
    //   .map((s) => this.slopeDeflection.updatedGetEquations(s));

    return this.nodes
      .filter((s) => s.support?.type !== "fixed")
      .map((s) => this.slopeDeflection.updatedGetEquations(s));
  }

  /** Solve for final moments at supports */
  // getFinalMoments() {
  //   const supportMoments = this.getSupportMoments();
  //   const equations = this.getEquations();
  //   const simulEqnSoln = this.equation.solveEquations(equations);

  //   const momentValues = supportMoments.map((supportEqn, index) => {
  //     // console.log(supportEqn.left, supportEqn.right);

  //     const leftMoment = Object.fromEntries(
  //       supportEqn.left.map((term) => [term.name, term.coefficient])
  //     );
  //     const rightMoment = Object.fromEntries(
  //       supportEqn.right.map((term) => [term.name, term.coefficient])
  //     );

  //     const leftMomentValue = Object.entries(leftMoment).reduce(
  //       (acc, [key, coeff]) => {
  //         const value = simulEqnSoln[key] || 1;
  //         return acc + coeff * value;
  //       },
  //       0
  //     );

  //     const rightMomentValue = Object.entries(rightMoment).reduce(
  //       (acc, [key, coeff]) => {
  //         const value = simulEqnSoln[key] || 1;
  //         return acc + coeff * value;
  //       },
  //       0
  //     );

  //     // assign the left and right moments for each supports here
  //     const supports = this.getSupports();
  //     const support = supports[index];
  //     if (support) {
  //       support.leftMoment = leftMomentValue;
  //       support.rightMoment = rightMomentValue;
  //     }

  //     console.log({
  //       leftMoment: leftMomentValue,
  //       rightMoment: rightMomentValue,
  //     });
  //     return { leftMoment: leftMomentValue, rightMoment: rightMomentValue };
  //   });

  //   return momentValues;
  // }

  updatedGetFinalMoments() {
    const supportMoments = this.updatedGetSupportMoments();
    const equations = this.updatedGetEquations();
    const simulEqnSoln = this.equation.solveEquations(equations);

    // console.dir(supportMoments, { depth: Infinity });

    const momentValues = supportMoments.map((supportEqn, index) => {
      // const leftMoment = Object.values(
      // Object.values(supportEqn.clk).map((term) => [term.name, term.coefficient])

      // );

      const leftMoment = Object.fromEntries(
        Object.values(supportEqn.clk)
          .flat()
          .map((term) => [term.name, term.coefficient]),
      );

      const rightMoment = Object.fromEntries(
        Object.values(supportEqn.antiClk)
          .flat()
          .map((term) => [term.name, term.coefficient]),
      );

      const leftMomentValue = Object.entries(leftMoment).reduce(
        (acc, [key, coeff]) => {
          const value = simulEqnSoln[key] || 1;
          return acc + coeff * value;
        },
        0,
      );

      const rightMomentValue = Object.entries(rightMoment).reduce(
        (acc, [key, coeff]) => {
          const value = simulEqnSoln[key] || 1;
          return acc + coeff * value;
        },
        0,
      );

      // assign the left and right moments for each supports here
      const supports = this.getSupports();
      const support = supports[index];
      if (support) {
        support.leftMoment = leftMomentValue;
        support.rightMoment = rightMomentValue;
      }

      // console.log({
      //   leftMoment: leftMomentValue,
      //   rightMoment: rightMomentValue,
      // });
      return { leftMoment: leftMomentValue, rightMoment: rightMomentValue };
    });

    return momentValues;
  }

  // solveReactions(beam: Beam) {
  //   const loads = beam.getEquivalentPointLoads();
  //   const L = beam.length;
  //   const leftSupport = beam.startNode.support || null;
  //   const rightSupport = beam.endNode.support || null;
  //   const leftMoment = leftSupport.rightMoment ?? 0;
  //   const rightMoment = rightSupport.leftMoment ?? 0;

  //   if (leftSupport && rightSupport) {
  //     const refPos = leftSupport.x;

  //     const loadMoments = loads.reduce((acc: number, curr: PointLoad) => {
  //       const distance = curr.position - refPos;
  //       const moment = curr.magnitude * distance;

  //       return acc + moment;
  //     }, 0);

  //     const rightReaction = (loadMoments - leftMoment - rightMoment) / L;

  //     const totalLoads = loads.reduce((acc: number, curr: PointLoad) => {
  //       return acc + curr.magnitude;
  //     }, 0);

  //     const leftReaction = totalLoads - rightReaction;

  //     return { leftReaction, rightReaction };
  //   } else {
  //     // when we are haveing overhanging write the logic here
  //   }
  // }

  // Get the reaction for a single support

  updatedSolveReactions(member: Beam) {
    const loads = member.getEquivalentPointLoads();
    const L = member.length;
    const startNode = member.startNode;
    const endNode = member.endNode;
    const leftMoment = startNode.support?.rightMoment ?? 0;
    const rightMoment = endNode.support?.leftMoment ?? 0;

    const loadMoments = loads.reduce((acc: number, curr: PointLoad) => {
      const distance = curr.position;
      const moment = curr.magnitude * distance;

      return acc + moment;
    }, 0);

    const totalLoads = loads.reduce((acc: number, curr: PointLoad) => {
      return acc + curr.magnitude;
    }, 0);

    let leftReaction = 0;
    let rightReaction = 0;

    if (startNode.support && endNode.support) {
      rightReaction = (loadMoments - leftMoment - rightMoment) / L;

      leftReaction = totalLoads - rightReaction;

      return { leftReaction, rightReaction };
    } else {
      if (member.startNode.support && !member.endNode.support) {
        leftReaction = totalLoads;
      } else if (!member.startNode.support && member.endNode.support) {
        rightReaction = totalLoads;
      }
    }

    return { leftReaction, rightReaction };
  }

  // getSupportReactions() {
  //   const supports = this.getSupports();

  //   const result: Record<string, number> = {};

  //   supports
  //     .filter(
  //       (support): support is PinnedSupport | RollerSupport | FixedSupport =>
  //         support !== null
  //     )
  //     .forEach((support) => {
  //       // LEFT

  //       const leftReaction = support.leftBeam
  //         ? this.solveReactions(support.leftBeam)?.rightReaction ?? 0
  //         : 0;

  //       // RIGHT

  //       const rightReaction = support.rightBeam
  //         ? this.solveReactions(support.rightBeam)?.leftReaction ?? 0
  //         : 0;

  //       result[`SUPPORT${support.id}`] = leftReaction + rightReaction;
  //     });
  //   return result;
  // }

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
}

// const output = new BeamSolver([AB, BC, CD, DE]);
// console.log(output.updatedGetFinalMoments());
// console.log(output.updatedGetSupportReactions());

// output.updatedGetFinalMoments();
