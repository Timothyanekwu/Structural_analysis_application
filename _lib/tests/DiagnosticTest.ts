import { FrameSolver } from "../frameSolver/frameSolver";
import { Beam, Column } from "../elements/member";
import { Node } from "../elements/node";
import {
  FixedSupport,
  PinnedSupport,
  RollerSupport,
} from "../elements/support";
import { PointLoad } from "../elements/load";

// Test 1: Nodal loads
const supportA1 = new FixedSupport(0, 0);
const supportB1 = new FixedSupport(4, 0);
const nodeA1 = new Node("A1", 0, 0, supportA1);
const nodeB1 = new Node("B1", 4, 0, supportB1);
nodeA1.addVerticalLoad(-10); // 10 downward
nodeA1.addHorizontalLoad(20); // 20 rightward

const frame1 = new FrameSolver([new Beam(nodeA1, nodeB1, 1, 1, null, 1, 1)]);
console.log("Test 1 (Nodal Loads) Reactions:");
console.log(frame1.updatedSolveReactions());

// Test 2: Overhang / Cantilever
const supportA2 = new FixedSupport(0, 0);
const nodeA2 = new Node("A2", 0, 0, supportA2);
const nodeB2 = new Node("B2", 4, 0);
const beam2 = new Beam(nodeA2, nodeB2, 1, 1, null, 1, 1);
beam2.addLoad(new PointLoad(4, 10)); // 10 downward at end of overhang

const frame2 = new FrameSolver([beam2]);
console.log("\nTest 2 (Overhang) Reactions:");
console.log(frame2.updatedSolveReactions());
