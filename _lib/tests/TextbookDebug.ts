/**
 * Debug trace for textbook portal frame.
 * Prints equation objects, solved unknowns, and end moments.
 */

import { FrameSolver } from "../frameSolver/frameSolver";
import { Beam, Column } from "../elements/member";
import { Node } from "../elements/node";
import { FixedSupport } from "../elements/support";
import { VDL } from "../elements/load";
import { Equation } from "../logic/simultaneousEqn";

const supportA = new FixedSupport(0, 0);
const supportD = new FixedSupport(8, 0);
const nodeA = new Node("A", 0, 0, supportA);
const nodeB = new Node("B", 0, 12);
const nodeC = new Node("C", 8, 12);
const nodeD = new Node("D", 8, 0, supportD);

const AB = new Column(nodeA, nodeB, 0, 0, 1, 1);
const BC = new Beam(nodeB, nodeC, 0, 0, null, 1, 1);
// Intentionally model right column top->bottom to match common UI draw order.
const DC = new Column(nodeC, nodeD, 0, 0, 1, 1);

// Symmetric triangular load with peak 24 kN/m at midspan.
BC.addLoad(new VDL(24, 4, 0, 0));
BC.addLoad(new VDL(24, 4, 0, 8));

const solver = new FrameSolver([AB, BC, DC]);

console.log("=== SWAY CHECK ===");
console.log("isSideSwaySusceptible:", solver.isSideSwaySusceptible());
console.log("isSideSway (effective):", solver.isSideSway());

console.log("\n=== EQUATIONS ===");
const equations = solver.updatedGetEquations();
equations.forEach((eq, i) => {
  console.log(`Eq ${i + 1}:`, JSON.stringify(eq));
});

const unknowns = new Equation().solveEquations(equations, {
  allowLeastSquares: true,
});
console.log("\nSolved unknowns:", unknowns);

console.log("\n=== SYMBOLIC END MOMENTS ===");
const symbolic = solver.updatedGetSupportMoments();
for (const block of symbolic) {
  for (const [key, terms] of Object.entries(block.clk)) {
    console.log(`${key}:`, JSON.stringify(terms));
  }
}

console.log("\n=== FINAL MOMENTS ===");
const moments = solver.updatedGetFinalMoments();
console.log("internal sign:", moments);
console.log(
  "textbook sign:",
  Object.fromEntries(Object.entries(moments).map(([k, v]) => [k, -v])),
);
