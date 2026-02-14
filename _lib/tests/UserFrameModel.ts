import { FrameSolver } from "../frameSolver/frameSolver";
import { Beam, Column } from "../elements/member";
import { Node } from "../elements/node";
import { FixedSupport, PinnedSupport } from "../elements/support";
import { PointLoad, UDL } from "../elements/load";

// Current user model.
// Use one consistent unit system only.
// If your geometry is in meters and load in kN, moments are kN*m directly.
const E = 1;
const I_COLUMN = 1;
const I_BEAM = 1;

// const COLUMN_HEIGHT = 20 * 12; // 20 ft
// const SPAN = 30 * 12; // 30 ft
// const SETTLEMENT_B = 0.75; // 3/4 in downward at support B

const supportA = new FixedSupport(0, 0);
const supportB = new FixedSupport(7, 2);

const nodeA = new Node("A", supportA.x, supportA.y, supportA);
const nodeB = new Node("B", supportB.x, supportB.y, supportB);
const nodeC = new Node("C", supportA.x, 7);
const nodeD = new Node("D", supportB.x, 7);

const AC = new Column(nodeA, nodeC, 0, 0, E, I_COLUMN);
const CD = new Beam(nodeC, nodeD, 0, 0, null, E, I_BEAM);
const BD = new Column(nodeB, nodeD, 0, 0, E, I_COLUMN);

CD.addLoad(new PointLoad(3, 40));

const solver = new FrameSolver([AC, CD, BD]);

console.log("--- SOLVING FRAME ---");
const moments = solver.updatedGetFinalMoments();
const reactions = solver.updatedSolveReactions();

console.log("FINAL MOMENTS (same force*length unit as your inputs):");
console.log(moments);

console.log("\nSUPPORT REACTIONS (same force unit as your loads):");
console.log(Object.fromEntries(reactions));

// Equilibrium checks for this current model:
// - External horizontal load = 0
// - External vertical load = +40
const supportRx = ["A", "B"].reduce(
  (s, id) => s + (reactions.get(id)?.xReaction ?? 0),
  0,
);
const supportRy = ["A", "B"].reduce(
  (s, id) => s + (reactions.get(id)?.yReaction ?? 0),
  0,
);

console.log("\nEQUILIBRIUM CHECK:");
console.log("Sum Rx =", supportRx, "(target 0)");
console.log("Sum Ry =", supportRy, "(target +40)");

const passFx = Math.abs(supportRx) < 1e-6;
const passFy = Math.abs(supportRy - 40) < 1e-6;
console.log("Global equilibrium:", passFx && passFy ? "PASS" : "FAIL");
