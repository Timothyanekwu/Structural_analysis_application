import { FrameSolver } from "../frameSolver/frameSolver";
import { Beam, Column } from "../elements/member";
import { Node } from "../elements/node";
import { PinnedSupport, RollerSupport } from "../elements/support";
import { PointLoad, UDL } from "../elements/load";

// Setup nodes
const supportA = new PinnedSupport(20, 0);
const supportC = new RollerSupport(0, 15);

const nodeA = new Node("A", 20, 0, supportA);
const nodeB_virtual = null; // We add load directly to AD at 5ft from A
const nodeC = new Node("C", 0, 15, supportC);
const nodeD = new Node("D", 20, 15);
const nodeE = new Node("E", 25, 15);

// The problem states the whole top beam CE has a uniform load 3k/ft.
// Dimensions are CD=20, DE=5. And the diagram indicates 2I for the bottom dimension arrow.
// Assuming 2I is for the whole beam CE or just CD? Usually overhangs might have the same section.
// Let's assume CD has 2I and DE has 2I.
// Column AD has length 15 (10+5). It has I.
const I = 1;
const I_val = 2;

const AD = new Column(nodeA, nodeD, 0, 0, 1, I_val / 2); // Column M1, wait I = 1 is correct. let's just use 1.
const DC = new Beam(nodeD, nodeC, 0, 0, null, 1, (2 * I_val) / 2); // Beam M3
const DE = new Beam(nodeD, nodeE, 0, 0, null, 1, (2 * I_val) / 2); // Beam M2

// Loads
// Column load: 15k to the left at 5ft from A.
// Positive load on Column: Let's test if positive is left or right. The user's M1 FEM has positive 16.67 at end.
// We will try magnitude 15 and -15 to see which one matches the FEM of -33.33 and 16.67.
AD.addLoad(new PointLoad(5, -15));

// Beam loads: 3k/ft downwards.
// It seems from previous files that positive load magnitude is downwards.
DC.addLoad(new UDL(0, 20, 3));
DE.addLoad(new UDL(0, 5, 3));

const solver = new FrameSolver([AD, DC, DE], true);
console.log("=== SWAY SUSCEPTIBLE ===", solver.isSideSwaySusceptible());

console.log("\n=== FEMs ===");
const FEM = solver.FEM;
// We check FEMs. Note that FEM.getFixedEndMoment returns values.
console.log("AD start (A):", FEM.getFixedEndMoment(AD, "start")); // Expected: -33.33
console.log("AD end (D):", FEM.getFixedEndMoment(AD, "end")); // Expected: 16.67
console.log("DC start (D):", FEM.getFixedEndMoment(DC, "start"));
console.log("DC end (C):", FEM.getFixedEndMoment(DC, "end"));
console.log("DE start (D):", FEM.getFixedEndMoment(DE, "start"));
console.log("DE end (E):", FEM.getFixedEndMoment(DE, "end"));

console.log("\n=== MOMENTS ===");
const moments = solver.updatedGetFinalMoments();
console.log(moments);

console.log("\n=== REACTIONS ===");
const reactions = solver.updatedSolveReactions();
console.log(reactions);
