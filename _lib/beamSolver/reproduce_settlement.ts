
import { Beam } from "../elements/member";
import { PinnedSupport, RollerSupport, FixedSupport } from "../elements/support";
import { Node } from "../elements/node";
import { BeamSolver } from "./beamSolver";

// Theoretical Example:
// 2-span beam A-B-C. 
// A: Fixed, B: Roller, C: Roller.
// Spans AB = 10ft, BC = 10ft. EI = 1000 k-ft^2.
// Support B sinks by 0.1ft.
// Expected results can be verified with manual calculations.

const E = 1000;
const I = 1;
const L = 10;

// Nodes and Supports
const supA = new FixedSupport(0, 0);
const supB = new RollerSupport(L, 0, undefined, 0.1); // B sinks by 0.1
const supC = new RollerSupport(2 * L, 0);

const nodeA = new Node("A", 0, 0, supA);
const nodeB = new Node("B", L, 0, supB);
const nodeC = new Node("C", 2 * L, 0, supC);

// Beams
const AB = new Beam(nodeA, nodeB, 0, 0, null, E, I);
const BC = new Beam(nodeB, nodeC, 0, 0, null, E, I);

const solver = new BeamSolver([AB, BC]);

console.log("--- Settlement Problem Reproduction ---");
console.log("Support A: Fixed at x=0");
console.log("Support B: Roller at x=10, Sinks 0.1ft");
console.log("Support C: Roller at x=20");

const finalMoments = solver.updatedGetFinalMoments();
console.log("\nCalculated Moments:");
finalMoments.forEach((m, i) => {
    const nodeName = ["A", "B", "C"][i];
    console.log(`Node ${nodeName}: Left=${m.leftMoment.toFixed(2)}, Right=${m.rightMoment.toFixed(2)}`);
});

// Theoretical check:
// M_AB = 2EI/L (0 + theta_B - 3*(-0.1/10)) = 200 (theta_B + 0.03) = 200*theta_B + 6
// M_BA = 2EI/L (2*theta_B + 0 - 3*(-0.1/10)) = 200 (2*theta_B + 0.03) = 400*theta_B + 6
// M_BC = 3EI/L (theta_B - (0 - (-0.1))/10) = 300 (theta_B - 0.01) = 300*theta_B - 3
// Eq at B: M_BA + M_BC = 0 => 700*theta_B + 3 = 0 => theta_B = -3/700 = -0.0042857
// M_AB = 200*(-3/700) + 6 = -6/7 + 6 = 5.1428
// M_BA = 400*(-3/700) + 6 = -12/7 + 6 = 4.2857
// M_BC = 300*(-3/700) - 3 = -9/7 - 3 = -4.2857
// M_CB = 0
