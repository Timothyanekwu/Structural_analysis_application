import { FrameSolver } from "../frameSolver/frameSolver";
import { Node } from "../elements/node";
import { Column, Beam } from "../elements/member";
import {
  PinnedSupport,
  RollerSupport,
  FixedSupport,
} from "../elements/support";
import { PointLoad, UDL } from "../elements/load";

const nodeC = new Node("N1", 0, 15, new RollerSupport(0, 15)); // user's N1
const nodeA = new Node("N2", 20, 0, new PinnedSupport(20, 0)); // user's N2
const nodeD = new Node("N3", 20, 15);
const nodeE = new Node("N4", 25, 15);

// M1: A to D
const M1 = new Column(nodeA, nodeD, 0, 0, 1, 1);
// M2: D to E
const M2 = new Beam(nodeD, nodeE, 0, 0, null, 1, 2);
// M3: D to C (Drawn Right-to-Left!)
const M3 = new Beam(nodeD, nodeC, 0, 0, null, 1, 2);

// Exact UI loading protocol
M1.addLoad(new PointLoad(5, -15));
M2.addLoad(new UDL(0, 5, 3));
M3.addLoad(new UDL(0, 20, -3)); // since D to C is angle 180, global Y -3 becomes transverse -3

const solver = new FrameSolver([M1, M2, M3], true);
console.log("--- REAGCTIONS (WITH FIX) ---");
const reactions = solver.updatedSolveReactions();
console.log(reactions);
