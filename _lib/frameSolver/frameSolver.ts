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
import { column, sort } from "mathjs";

// --- CREATE SUPPORTS ---
// const supportA = new FixedSupport(0, 0);
// const supportB = new FixedSupport(30, 0);
// const supportE = new PinnedSupport(60, 20);

const supportA = new FixedSupport(0, 2);
const supportC = new PinnedSupport(6, 6);
const supportD = new PinnedSupport(6, 0);

// --- CREATE NODES ---
const nodeA = new Node("A", supportA.x, supportA.y, supportA);
const nodeB = new Node("B", supportA.x, 6);
const nodeC = new Node("C", supportC.x, supportC.y, supportC);
const nodeD = new Node("D", supportD.x, supportD.y, supportD);
// const nodeE = new Node("E", supportE.x, supportE.y, supportE);

// --- CREATE MEMBERS ---
const AB = new Column(nodeA, nodeB);
const BC = new Beam(nodeB, nodeC);
const CD = new Column(nodeC, nodeD);
// const DE = new Beam(nodeD, nodeE);

// --- ADD LOADS ---
// CD.addLoad(new UDL(0, 30, 2));
// DE.addLoad(new UDL(0, 30, 2));
// AC.addLoad(new PointLoad(10, 40));

AB.addLoad(new UDL(0, 4, 8));
BC.addLoad(new UDL(0, 6, 25));
CD.addLoad(new UDL(0, 5, 6));
AB.addLoad(new PointLoad(2, 8));
BC.addLoad(new PointLoad(2, 16));
BC.addLoad(new PointLoad(4, 20));
CD.addLoad(new PointLoad(3, 20));

// --- LINK BEAMS TO SUPPORTS ---

export class FrameSolver {
  members: (Beam | Column | InclinedMember)[];
  FEM: FixedEndMoments;
  slopeDeflection: SlopeDeflection;
  equation: Equation;

  constructor(members: (Beam | Column | InclinedMember)[] = []) {
    this.members = members;
    this.FEM = new FixedEndMoments();
    this.slopeDeflection = new SlopeDeflection();
    this.equation = new Equation();
  }

  get nodes(): Node[] {
    return [...new Set(this.members.flatMap((b) => [b.startNode, b.endNode]))];
  }

  get supports(): (PinnedSupport | RollerSupport | FixedSupport)[] {
    return this.nodes
      .map((node) => node.support)
      .filter(
        (support): support is PinnedSupport | RollerSupport | FixedSupport =>
          support !== undefined,
      );
  }

  isSideSway(): boolean {
    const j = this.nodes.length;
    const f = this.supports.filter(
      (support): support is FixedSupport => support !== undefined,
    ).length;
    const h = this.supports.filter(
      (support): support is PinnedSupport => support !== undefined,
    ).length;
    const r = this.supports.filter(
      (support): support is RollerSupport => support !== undefined,
    ).length;
    const m = this.members.length;

    const ss = 2 * j - (2 * (f + h) + r + m);

    if (ss == 0) return true;
    return false;
  }

  updatedGetSupportMoments() {
    return this.nodes.map((node) => {
      const a = this.slopeDeflection.updatedSupportEquation(node);
      // console.log(node.id);
      // console.dir(a, { depth: Infinity });

      return a;
    });
  }

  updatedGetEquations() {
    // const supports = this.getSupports();
    // return supports
    //   .filter((s) => s.type !== "fixed")
    //   .map((s) => this.slopeDeflection.updatedGetEquations(s));

    return this.nodes
      .filter((s) => s.support?.type !== "fixed")
      .map((s) => this.slopeDeflection.updatedGetEquations(s));
  }

  updatedGetFinalMoments() {
    const supportMoments = this.updatedGetSupportMoments();
    const equations = this.updatedGetEquations();
    const simulEqnSoln = this.equation.solveEquations(equations);
    // console.dir(supportMoments, { depth: Infinity });

    const result = supportMoments.reduce(
      (acc, eqn) => {
        const clk = Object.fromEntries(
          Object.entries(eqn.clk).map(([momentKey, terms]) => {
            const sum = terms.reduce((a, { name, coefficient }) => {
              const value = simulEqnSoln[name] ?? 1;
              return a + coefficient * value;
            }, 0);

            return [momentKey, sum];
          }),
        );

        const antiClk = Object.fromEntries(
          Object.entries(eqn.antiClk).map(([momentKey, terms]) => {
            const sum = terms.reduce((a, { name, coefficient }) => {
              const value = simulEqnSoln[name] ?? 1;
              return a + coefficient * value;
            }, 0);

            return [momentKey, sum];
          }),
        );

        // merge into accumulator
        Object.entries({ ...clk, ...antiClk }).forEach(([key, value]) => {
          acc[key] = (acc[key] ?? 0) + value;
        });

        return acc;
      },
      {} as Record<string, number>,
    );

    return result;
  }

  private computeBeamReactions(member: Beam) {
    const loads = member.getEquivalentPointLoads();
    const L = member.length;
    const moments = this.updatedGetFinalMoments();

    const Mstart =
      moments[`MOMENT${member.startNode.id}${member.endNode.id}`] ?? 0;
    const Mend =
      moments[`MOMENT${member.endNode.id}${member.startNode.id}`] ?? 0;

    // Standard beam vertical reaction (Shear) formula
    const loadMoments = loads.reduce((sum, load) => {
      const d = Math.abs(load.position - member.startNode.x);
      return sum + load.magnitude * d;
    }, 0);

    const RyEnd = (loadMoments - Mend - Mstart) / L;
    const totalLoad = loads.reduce((s, l) => s + l.magnitude, 0);
    const RyStart = totalLoad - RyEnd;

    return { RxStart: 0, RxEnd: 0, RyStart, RyEnd };
  }

  private computeColumnReactions(member: Column) {
    const loads = member.getEquivalentPointLoads();
    const L = member.length;
    const moments = this.updatedGetFinalMoments();

    const Mstart =
      moments[`MOMENT${member.startNode.id}${member.endNode.id}`] ?? 0;
    const Mend =
      moments[`MOMENT${member.endNode.id}${member.startNode.id}`] ?? 0;

    // Standard column horizontal reaction (Shear) formula
    const loadMoments = loads.reduce((sum, load) => {
      const d = Math.abs(load.position - member.startNode.y);
      return sum + load.magnitude * d;
    }, 0);

    const RxEnd = (loadMoments - Mend - Mstart) / L;
    const totalLoad = loads.reduce((s, l) => s + l.magnitude, 0);
    const RxStart = totalLoad - RxEnd;

    return { RxStart, RxEnd, RyStart: 0, RyEnd: 0 };
  }

  private applyMemberReactions(member: any, reactions: any) {
    member.startNode.xReaction += reactions.RxStart;
    member.endNode.xReaction += reactions.RxEnd;
    member.startNode.yReaction += reactions.RyStart;
    member.endNode.yReaction += reactions.RyEnd;
  }

  private backtrackVerticals(node: Node) {
    const termnlBaseNode = node.connectedMembers.find((member) => {
      if (member.member instanceof Column) {
        if (member.isStart) {
          if (member.member.endNode.y <= node.y) {
            return true;
          } else return false;
        } else {
          if (member.member.startNode.y <= node.y) {
            return true;
          } else return false;
        }
      } else return false;
    });

    if (node.support || !termnlBaseNode) return;

    node.connectedMembers.forEach((member) => {
      if (member.isStart) {
        if (member.member.endNode.y < node.y - 0.001) {
          const vy = node.yReaction;

          // 2. Calculate Horizontal Thrust for Inclined Members
          const dx = member.member.endNode.x - node.x;
          const dy = member.member.endNode.y - node.y;

          // Thrust logic: Rx = Vy * (dx/dy)
          const thrust = dy !== 0 ? vy * (dx / Math.abs(dy)) : 0;
          const vx = node.xReaction + thrust;

          // console.log("Reactions: ", vx, vy);

          member.member.endNode.yReaction += vy;
          // member.member.endNode.xReaction += vx;

          // member.member.endReactions.RxStart = -vx;
          member.member.endReactions.RyStart = -vy;
          // member.member.endReactions.RxEnd = vx;
          member.member.endReactions.RyEnd = vy;

          this.backtrackVerticals(member.member.endNode);
        }
      } else {
        if (member.member.startNode.y < node.y - 0.001) {
          const vy = node.yReaction;

          // 2. Calculate Horizontal Thrust for Inclined Members
          const dx = member.member.startNode.x - node.x;
          const dy = member.member.startNode.y - node.y;

          // Thrust logic: Rx = Vy * (dx/dy)
          const thrust = dy !== 0 ? vy * (dx / Math.abs(dy)) : 0;
          const vx = node.xReaction + thrust;

          // console.log("Reactions: ", vx, vy);

          member.member.startNode.yReaction += vy;
          // member.member.startNode.xReaction += vx;

          // member.member.endReactions.RxEnd = -vx;
          member.member.endReactions.RyEnd = -vy;
          // member.member.endReactions.RxStart = vx;
          member.member.endReactions.RyStart = vy;

          this.backtrackVerticals(member.member.startNode);
        }
      }
    });
  }

  private getNodeChain(startNode: Node): Node[] {
    const result: Node[] = [];
    const visited = new Set<Node>();

    const dfs = (node: Node) => {
      if (!node || visited.has(node)) return;

      visited.add(node);
      result.push(node);

      node.connectedMembers.forEach((member) => {
        if (member.member instanceof Column) return;

        const next =
          member.member.startNode === node
            ? member.member.endNode
            : member.member.startNode;

        dfs(next);
      });
    };

    dfs(startNode);
    return result;
  }

  // --- CASES ---
  // case 1: L-joint to Pinned/Fixed support (known to unknown)
  private case1(leftNode: Node, direction: "left" | "right") {
    const visitedUpdate = new Set<Node>();

    const updateNodes = (node: Node) => {
      if (visitedUpdate.has(node)) return;
      visitedUpdate.add(node);

      for (const conn of node.connectedMembers) {
        const member = conn.member;

        // Only horizontal beams
        const isHorizontal =
          Math.abs(member.startNode.y - member.endNode.y) < 0.001 &&
          member instanceof Beam;
        if (!isHorizontal) continue;

        if (direction === "right") {
          const nextNode = conn.isStart ? member.endNode : member.startNode;

          // Only propagate rightwards
          if (nextNode.x <= node.x) continue;

          // Transfer reactions
          nextNode.xReaction += node.xReaction;
          // nextNode.yReaction += node.yReaction;

          // Assign member end reactions
          if (conn.isStart) {
            member.endReactions.RxStart = -node.xReaction;
            // member.endReactions.RyStart = -node.yReaction;
            member.endReactions.RxEnd = node.xReaction;
            // member.endReactions.RyEnd = node.yReaction;
          } else {
            member.endReactions.RxEnd = -node.xReaction;
            // member.endReactions.RyEnd = -node.yReaction;
            member.endReactions.RxStart = node.xReaction;
            // member.endReactions.RyStart = node.yReaction;
          }

          // Clear current node to avoid double counting
          // node.xReaction = 0;
          // node.yReaction = 0;

          // Recursively update next node
          updateNodes(nextNode);
        } else if (direction === "left") {
          const nextNode = conn.isStart ? member.endNode : member.startNode;

          // Only propagate leftwards
          if (nextNode.x >= node.x) continue;

          // Transfer reactions
          nextNode.xReaction += node.xReaction;
          // nextNode.yReaction += node.yReaction;

          // Assign member end reactions
          if (conn.isStart) {
            member.endReactions.RxStart = -node.xReaction;
            // member.endReactions.RyStart = -node.yReaction;
            member.endReactions.RxEnd = node.xReaction;
            // member.endReactions.RyEnd = node.yReaction;
          } else {
            member.endReactions.RxEnd = -node.xReaction;
            // member.endReactions.RyEnd = -node.yReaction;
            member.endReactions.RxStart = node.xReaction;
            // member.endReactions.RyStart = node.yReaction;
          }

          // Clear current node to avoid double counting
          // node.xReaction = 0;
          // node.yReaction = 0;

          // Recursively update next node
          updateNodes(nextNode);
        }
      }
    };

    updateNodes(leftNode);
  }

  // case 2: Single anchored - One end is fixed, the other end is free or Roller
  // private case2(startNode: Node, direction: "left" | "right") {
  //   // --- Step 1: Traverse nodes from left to right along horizontal members ---
  //   const traverseNodes = (curr: Node) => {
  //     if (visited.has(curr)) return;
  //     visited.add(curr);

  //     nodes.push(curr);

  //     // Find horizontal members to propagate along
  //     for (const conn of curr.connectedMembers) {
  //       const member = conn.member;

  //       // Only horizontal beams
  //       const isHorizontal =
  //         Math.abs(member.startNode.y - member.endNode.y) < 0.001 &&
  //         member instanceof Beam;
  //       if (!isHorizontal) continue;

  //       const nextNode = conn.isStart ? member.endNode : member.startNode;

  //       // Only move rightwards
  //       if (nextNode.x <= curr.x) continue;

  //       traverseNodes(nextNode);
  //     }
  //   };
  // }

  private case3(startNode: Node) {
    const nodeChain = this.getNodeChain(startNode);

    let totalShear = 0;

    for (const node of nodeChain) {
      totalShear += node.xReaction;
    }

    startNode.xReaction += -totalShear;
    const visitedUpdate = new Set<Node>();

    const updateNodes = (node: Node) => {
      if (visitedUpdate.has(node)) return;
      visitedUpdate.add(node);

      for (const conn of node.connectedMembers) {
        const member = conn.member;

        // Only horizontal beams
        const isHorizontal =
          Math.abs(member.startNode.y - member.endNode.y) < 0.001 &&
          member instanceof Beam;
        if (!isHorizontal) continue;

        const nextNode = conn.isStart ? member.endNode : member.startNode;

        // Only propagate rightwards
        if (nextNode.x <= node.x) continue;

        // Transfer reactions
        nextNode.xReaction += node.xReaction;
        // nextNode.yReaction += node.yReaction;

        // Assign member end reactions
        if (conn.isStart) {
          member.endReactions.RxStart = -node.xReaction;
          // member.endReactions.RyStart = -node.yReaction;
          member.endReactions.RxEnd = node.xReaction;
          // member.endReactions.RyEnd = node.yReaction;
        } else {
          member.endReactions.RxEnd = -node.xReaction;
          // member.endReactions.RyEnd = -node.yReaction;
          member.endReactions.RxStart = node.xReaction;
          // member.endReactions.RyStart = node.yReaction;
        }

        // Clear current node to avoid double counting
        // node.xReaction = 0;
        // node.yReaction = 0;

        // Recursively update next node
        updateNodes(nextNode);
      }
    };

    updateNodes(startNode);
  }

  // case 3: Free to Free / Roller to roller (Known to unknown to known)
  // case 4: Trapped - Both ends with Fixed support/ Pinned Support
  private case4(leftNode: Node, rightNode: Node) {
    const totalLength = rightNode.x - leftNode.x;
    let totalShear = 0;
    let nodes: Node[] = [];

    // Keep track of visited nodes to prevent infinite loops
    const visited = new Set<Node>();

    // --- Step 1: Traverse nodes from left to right along horizontal members ---
    const traverseNodes = (curr: Node) => {
      if (visited.has(curr)) return;
      visited.add(curr);

      nodes.push(curr);

      // Find horizontal members to propagate along
      for (const conn of curr.connectedMembers) {
        const member = conn.member;

        // Only horizontal beams
        const isHorizontal =
          Math.abs(member.startNode.y - member.endNode.y) < 0.001 &&
          member instanceof Beam;
        if (!isHorizontal) continue;

        const nextNode = conn.isStart ? member.endNode : member.startNode;

        // Only move rightwards
        if (nextNode.x <= curr.x) continue;

        traverseNodes(nextNode);
      }
    };

    traverseNodes(leftNode);

    console.log(
      "Internal Nodes in path:",
      nodes.map((n) => n.id),
    );

    // --- Step 2: Compute total "moment" Pb along horizontal members ---
    let Pb = 0;
    for (const node of nodes) {
      const b = rightNode.x - node.x;
      Pb += node.xReaction * b;
    }

    // --- Step 3: Seed left node reaction ---
    const isFixed = (node: Node) => {
      if (
        (!node.support || node.support.type === "roller") &&
        node.connectedMembers.length <= 1
      ) {
        return false;
      }

      return true;
    };
    leftNode.xReaction +=
      !isFixed(leftNode) && !isFixed(rightNode) ? 0 : Pb / totalLength;

    // --- Step 4: Redistribute reactions along horizontal members ---
    const visitedUpdate = new Set<Node>();

    const updateNodes = (node: Node) => {
      if (visitedUpdate.has(node)) return;
      visitedUpdate.add(node);

      for (const conn of node.connectedMembers) {
        const member = conn.member;

        // Only horizontal beams
        const isHorizontal =
          Math.abs(member.startNode.y - member.endNode.y) < 0.001 &&
          member instanceof Beam;
        if (!isHorizontal) continue;

        const nextNode = conn.isStart ? member.endNode : member.startNode;

        // Only propagate rightwards
        if (nextNode.x <= node.x) continue;

        // Transfer reactions
        nextNode.xReaction += node.xReaction;
        // nextNode.yReaction += node.yReaction;

        // Assign member end reactions
        if (conn.isStart) {
          member.endReactions.RxStart = -node.xReaction;
          // member.endReactions.RyStart = -node.yReaction;
          member.endReactions.RxEnd = node.xReaction;
          // member.endReactions.RyEnd = node.yReaction;
        } else {
          member.endReactions.RxEnd = -node.xReaction;
          // member.endReactions.RyEnd = -node.yReaction;
          member.endReactions.RxStart = node.xReaction;
          // member.endReactions.RyStart = node.yReaction;
        }

        // Clear current node to avoid double counting
        // node.xReaction = 0;
        // node.yReaction = 0;

        // Recursively update next node
        updateNodes(nextNode);
      }
    };

    updateNodes(leftNode);
  }

  updatedSolveReactions() {
    // 1. Reset all nodes
    this.nodes.forEach((n) => {
      n.xReaction = 0;
      n.yReaction = 0;
    });

    // 2. Calculate Local Shears (Member-level reactions)

    for (const member of this.members) {
      let reactions;
      if (member instanceof Beam) {
        reactions = this.computeBeamReactions(member);
      } else if (member instanceof Column) {
        reactions = this.computeColumnReactions(member);
      } else {
        throw new Error("Unknown member type");
      }
      this.applyMemberReactions(member, reactions);
    }

    // 4. AXIAL TRANSFER PASS
    // We sort nodes by X to ensure horizontal forces flow from Left to Right (A/C -> D -> E)
    const sortedNodes = [...this.nodes].sort((a, b) => a.x - b.x);

    for (const node of sortedNodes) {
      const target = node.connectedMembers.find((member) => {
        if (member.member instanceof Column) {
          if (member.isStart) {
            if (member.member.endNode.y >= node.y) {
              return true;
            } else return false;
          } else {
            if (member.member.startNode.y >= node.y) {
              return true;
            } else return false;
          }
        } else return false;
      });

      if (target) continue;
      else {
        this.backtrackVerticals(node);
      }
    }

    // const nodeChain = this.getNodeChain()
    // console.log(sortedNodes[3].xReaction);
    // this.case4(sortedNodes[0], );

    const results = new Map<string, { xReaction: number; yReaction: number }>();

    this.nodes.forEach((node) => {
      results.set(node.id, {
        xReaction: node.xReaction,
        yReaction: node.yReaction,
      });
    });
    return results;
  }
}

// const output = new FrameSolver([AB, BC, CD]);
// console.log(output.updatedGetFinalMoments());
// console.log(output.updatedSolveReactions());

// console.log("NODE_A: ", nodeA.yReaction, nodeA.xReaction);
// console.log("NODE_C: ", nodeC.yReaction, nodeC.xReaction);
// console.log("NODE_D: ", nodeD.yReaction, nodeD.xReaction);
// console.log("NODE_B: ", nodeB.yReaction, nodeB.xReaction);
// console.log("NODE_E: ", nodeE.yReaction, nodeE.xReaction);

// console.log(output.updatedGetSupportReactions());
