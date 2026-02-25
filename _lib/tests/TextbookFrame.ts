/**
 * Textbook non-sway portal-frame check.
 *
 * Geometry:
 *  A(0,0) fixed   D(8,0) fixed
 *  B(0,12) ------ C(8,12)
 *
 * Top beam loading in textbook sketch is a symmetric triangular ("tent")
 * distribution with peak 24 kN/m at midspan:
 *   w(0)=0 -> w(4)=24 -> w(8)=0
 *
 * We model this as two VDL segments on BC:
 * - left half:  0 -> 24 from x=0 to x=4
 * - right half: 24 -> 0 from x=4 to x=8
 *
 * Internal solver sign convention is opposite to textbook convention for end
 * moments. We compare against textbook values after sign flip.
 */

import { FrameSolver } from "../frameSolver/frameSolver";
import { Beam, Column } from "../elements/member";
import { Node } from "../elements/node";
import { FixedSupport } from "../elements/support";
import { VDL } from "../elements/load";

const E = 1;
const I = 1;

const supportA = new FixedSupport(0, 0);
const supportD = new FixedSupport(8, 0);

const nodeA = new Node("A", 0, 0, supportA);
const nodeB = new Node("B", 0, 12);
const nodeC = new Node("C", 8, 12);
const nodeD = new Node("D", 8, 0, supportD);

const AB = new Column(nodeA, nodeB, 0, 0, E, I);
const BC = new Beam(nodeB, nodeC, 0, 0, null, E, I);
// Intentionally model right column top->bottom to match common UI draw order.
const DC = new Column(nodeC, nodeD, 0, 0, E, I);

// Symmetric triangular load with peak = 24 kN/m at midspan.
BC.addLoad(new VDL(24, 4, 0, 0));
BC.addLoad(new VDL(24, 4, 0, 8));

const solver = new FrameSolver([AB, BC, DC], true);

console.log("isSideSwaySusceptible:", solver.isSideSwaySusceptible());
console.log("isSideSway (effective):", solver.isSideSway());

console.log("\n--- SOLVING MOMENTS ---");
const moments = solver.updatedGetFinalMoments();
console.log("Solver moments (internal sign):", moments);

// Convert to textbook sign convention for direct comparison.
const textbookMoments: Record<string, number> = Object.fromEntries(
  Object.entries(moments).map(([k, v]) => [k, -v]),
);

const expected: Record<string, number> = {
  MOMENTAB: 22.9,
  MOMENTBA: 45.7,
  MOMENTBC: -45.7,
  MOMENTCB: 45.7,
  MOMENTCD: -45.7,
  MOMENTDC: -22.9,
};

console.log("\n--- COMPARISON (Textbook Sign) ---");
for (const [key, exp] of Object.entries(expected)) {
  const got = textbookMoments[key] ?? 0;
  const diff = Math.abs(got - exp);
  const pass = diff < 0.5;
  console.log(
    `  ${key}: got=${got.toFixed(2)}, expected=${exp.toFixed(1)}, diff=${diff.toFixed(2)} -> ${pass ? "PASS" : "FAIL"}`,
  );
}

console.log("\n--- SOLVING REACTIONS ---");
const reactions = solver.updatedSolveReactions();
console.log("Reactions:", Object.fromEntries(reactions));

let sumRx = 0;
let sumRy = 0;
for (const [, r] of reactions) {
  sumRx += r.xReaction;
  sumRy += r.yReaction;
}

// Total vertical load from tent load = (1/2)*8*24 = 96.
console.log(`\nSum Rx = ${sumRx.toFixed(4)} (expected 0)`);
console.log(`Sum Ry = ${sumRy.toFixed(4)} (expected 96)`);
