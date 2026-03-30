/**
 * Focused diagnostic on Test C to verify moment equilibrium and identify root cause.
 */
import { BeamSolver } from "../beamSolver/beamSolver";
import { Beam } from "../elements/member";
import { PointLoad, UDL } from "../elements/load";
import { Node } from "../elements/node";
import { FixedSupport, RollerSupport } from "../elements/support";
import { SlopeDeflection } from "../beamSolver/slopeDeflectionEqn";
import { Equation } from "../logic/simultaneousEqn";

function fmt(n: number) { return n.toFixed(4); }

// Test C: E(free,0) --- A(fixed,3) ========== B(roller,9) --- F(free,12)
const sA = new FixedSupport(3, 0);
const sB = new RollerSupport(9, 0, sA);

const nE = new Node("E", 0, 0);
const nA = new Node("A", 3, 0, sA);
const nB = new Node("B", 9, 0, sB);
const nF = new Node("F", 12, 0);

const leftOvh = new Beam(nE, nA, 0, 0, null, 1, 1);
const mainSpan = new Beam(nA, nB, 0, 0, null, 1, 1);
const rightOvh = new Beam(nB, nF, 0, 0, null, 1, 1);
leftOvh.addLoad(new UDL(0, 3, 10));
rightOvh.addLoad(new PointLoad(2, 20));

const solver = new BeamSolver([leftOvh, mainSpan, rightOvh]);

// Step 1: Dump the raw slope-deflection equations for each node
const sd = new SlopeDeflection();
const nodes = [nE, nA, nB, nF];

console.log("=== RAW SLOPE-DEFLECTION EQUATIONS ===\n");
for (const node of nodes) {
  console.log(`\nNode ${node.id} (support: ${node.support?.type ?? 'none'}):`);
  const { clk, antiClk } = sd.updatedSupportEquation(node);
  
  console.log("  CLK (clockwise / left-looking moments):");
  for (const [key, terms] of Object.entries(clk)) {
    const termStr = terms.map(t => `${t.name}:${fmt(t.coefficient)}`).join(", ");
    console.log(`    ${key}: [${termStr}]`);
  }
  
  console.log("  ANTICLK (anticlockwise / right-looking moments):");
  for (const [key, terms] of Object.entries(antiClk)) {
    const termStr = terms.map(t => `${t.name}:${fmt(t.coefficient)}`).join(", ");
    console.log(`    ${key}: [${termStr}]`);
  }
}

// Step 2: Dump the equations for non-fixed nodes
console.log("\n\n=== EQUATIONS FOR NON-FIXED NODES ===\n");
const nonFixed = nodes.filter(n => n.support?.type !== "fixed");
for (const node of nonFixed) {
  const eqn = sd.updatedGetEquations(node);
  console.log(`  Node ${node.id}: ${JSON.stringify(eqn)}`);
}

// Step 3: Solve and show solution
const solver2 = new BeamSolver([leftOvh, mainSpan, rightOvh]);
const equations = solver2.updatedGetEquations();
console.log("\n=== SIMULTANEOUS EQUATIONS ===");
console.log(JSON.stringify(equations, null, 2));

const eqSolver = new Equation();
const solution = eqSolver.solveEquations(equations, { allowLeastSquares: true });
console.log("\n=== SOLUTION ===");
console.log(JSON.stringify(solution));

// Step 4: Final moments
const moments = solver2.updatedGetFinalMoments();
console.log("\n=== FINAL MOMENTS ===");
for (const m of moments) {
  console.log(`  Node ${m.nodeId}: left=${fmt(m.leftMoment)}, right=${fmt(m.rightMoment)}`);
}

// Step 5: Reactions
const reactions = solver2.updatedGetSupportReactions();
console.log("\n=== REACTIONS ===");
for (const [key, val] of Object.entries(reactions)) {
  console.log(`  ${key}: Fy=${fmt(val.yReaction)}, M=${fmt(val.momentReaction)}`);
}

// Step 6: Global moment equilibrium check about A (x=3)
console.log("\n=== GLOBAL MOMENT EQUILIBRIUM CHECK (about A, x=3) ===");
const Ra = reactions[`SUPPORT${sA.id}`]?.yReaction ?? 0;
const Rb = reactions[`SUPPORT${sB.id}`]?.yReaction ?? 0;
const Ma = reactions[`SUPPORT${sA.id}`]?.momentReaction ?? 0;

// Loads: 30kN UDL at centroid x=1.5 (global), 20kN at x=11 (global)
// Moments about A (at x=3), clockwise positive:
// Loads create clockwise moments about A:
//   30kN at x=1.5: arm = 1.5 - 3 = -1.5 → moment = 30*(-1.5) = -45 (anticlockwise)
//   20kN at x=11:  arm = 11 - 3 = 8 → moment = 20*8 = 160 (clockwise)
// Rb at x=9: arm = 9-3 = 6 → moment = -Rb*6 (counteracts clockwise)
// Ma contributes directly

const loadMomentAboutA = 30*(-1.5) + 20*(11 - 3);
console.log(`  Load moment about A = ${fmt(loadMomentAboutA)} (30*(-1.5) + 20*8 = ${-45} + ${160})`);
console.log(`  Rb*6 = ${fmt(Rb*6)}`);
console.log(`  Ma = ${fmt(Ma)}`);
console.log(`  Equilibrium: Ma + Rb*6 + loadMomentAboutA should = 0 (taking away from A)`);
const residual = Ma - Rb*6 + loadMomentAboutA;  // Ma (reaction moment) - Rb*6 (reaction) + load moments
console.log(`  Actually, sum of moments about A = 0:`);
console.log(`    Ma (ACW positive) + load_ACW_moments + Rb_moment = 0`);
console.log(`    ${fmt(Ma)} + (-45) + 160 + ${fmt(-Rb*6)} = ${fmt(Ma - 45 + 160 - Rb*6)}`);
console.log(`    RESIDUAL = ${fmt(Ma - 45 + 160 - Rb*6)}`);

// Step 7: Check member-end reactions
console.log("\n=== MEMBER-END REACTIONS ===");
const r1 = solver2.updatedSolveReactions(leftOvh);
const r2 = solver2.updatedSolveReactions(mainSpan);
const r3 = solver2.updatedSolveReactions(rightOvh);
console.log(`  leftOvh (E-A): left=${fmt(r1.leftReaction)}, right=${fmt(r1.rightReaction)}`);
console.log(`  mainSpan (A-B): left=${fmt(r2.leftReaction)}, right=${fmt(r2.rightReaction)}`);
console.log(`  rightOvh (B-F): left=${fmt(r3.leftReaction)}, right=${fmt(r3.rightReaction)}`);
console.log(`  Total at A = leftOvh.right + mainSpan.left = ${fmt(r1.rightReaction + r2.leftReaction)}`);
console.log(`  Total at B = mainSpan.right + rightOvh.left = ${fmt(r2.rightReaction + r3.leftReaction)}`);
