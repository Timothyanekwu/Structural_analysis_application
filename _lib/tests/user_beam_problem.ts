/**
 * User's specific beam problem from the diagram:
 * 
 * A(fixed,0) --- B(pinned,6) --- C(roller,18) --- D(pinned,26) --- E(free,27.5)
 *     3I              10I              2I              2I
 * 
 * Loads:
 *   - UDL 24 kN/m on A-B (full span)
 *   - UDL 16 kN/m on B-C (full span)
 *   - 80 kN point load at 6m from B on B-C (i.e. mid-span, position=6)
 *   - 72 kN point load at 2m from C on C-D (position=2)
 *   - 24 kN point load at E (free end, position=1.5 on D-E)
 * 
 * D-E is the OVERHANGING member (E is free, D has support).
 */
import { BeamSolver } from "../beamSolver/beamSolver";
import { Beam } from "../elements/member";
import { PointLoad, UDL } from "../elements/load";
import { Node } from "../elements/node";
import { FixedSupport, PinnedSupport, RollerSupport } from "../elements/support";

function fmt(n: number) { return n.toFixed(4); }

// Supports
const sA = new FixedSupport(0, 0);
const sB = new PinnedSupport(6, 0, sA);
const sC = new RollerSupport(18, 0, sB);
const sD = new PinnedSupport(26, 0, sC);

// Nodes
const nA = new Node("A", 0, 0, sA);
const nB = new Node("B", 6, 0, sB);
const nC = new Node("C", 18, 0, sC);
const nD = new Node("D", 26, 0, sD);    // D has support, connected to overhang
const nE = new Node("E", 27.5, 0);       // E is FREE (overhang tip)

// Members with different I values (E=1 for all)
// Beam constructor: Beam(startNode, endNode, b, h, type, Ecoef, Icoef)
const spanAB = new Beam(nA, nB, 0, 0, null, 1, 3);   // 3I
const spanBC = new Beam(nB, nC, 0, 0, null, 1, 10);  // 10I
const spanCD = new Beam(nC, nD, 0, 0, null, 1, 2);   // 2I
const spanDE = new Beam(nD, nE, 0, 0, null, 1, 2);   // 2I (overhang)

// Loads
spanAB.addLoad(new UDL(0, 6, 24));           // 24 kN/m on full span A-B
spanBC.addLoad(new UDL(0, 12, 16));          // 16 kN/m on full span B-C
spanBC.addLoad(new PointLoad(6, 80));        // 80 kN at 6m from B (mid-span)
spanCD.addLoad(new PointLoad(2, 72));        // 72 kN at 2m from C  
spanDE.addLoad(new PointLoad(1.5, 24));      // 24 kN at E (tip of overhang)

const solver = new BeamSolver([spanAB, spanBC, spanCD, spanDE]);

console.log("=== USER'S BEAM PROBLEM ===");
console.log("A(fixed,0)---B(pinned,6)---C(roller,18)---D(pinned,26)---E(free,27.5)");
console.log("Spans: AB=6m(3I), BC=12m(10I), CD=8m(2I), DE=1.5m(2I)\n");

// Step 1: Node connectivity check
console.log("Node connectivity:");
for (const node of [nA, nB, nC, nD, nE]) {
  const members = node.connectedMembers.map(
    m => `${m.member.startNode.id}-${m.member.endNode.id}(${m.isStart ? 'start' : 'end'})`
  ).join(", ");
  console.log(`  ${node.id}: support=${node.support?.type ?? 'NONE'}, members=[${members}]`);
}

// Step 2: Final moments
console.log("\n--- Final Moments ---");
const moments = solver.updatedGetFinalMoments();
for (const m of moments) {
  console.log(`  Node ${m.nodeId}: leftM=${fmt(m.leftMoment)}, rightM=${fmt(m.rightMoment)}`);
}

// Step 3: Support reactions
console.log("\n--- Support Reactions ---");
const reactions = solver.updatedGetSupportReactions();
for (const [key, val] of Object.entries(reactions)) {
  console.log(`  ${key}: Fy=${fmt(val.yReaction)}, M=${fmt(val.momentReaction)}`);
}

// Step 4: Equilibrium check
const totalLoad = 24*6 + 16*12 + 80 + 72 + 24;  // = 144 + 192 + 80 + 72 + 24 = 512
let totalReaction = 0;
for (const r of Object.values(reactions)) {
  totalReaction += r.yReaction;
}
console.log(`\n--- Equilibrium Check ---`);
console.log(`  Total load: ${totalLoad} kN`);
console.log(`  Total reaction: ${fmt(totalReaction)} kN`);
console.log(`  Vertical diff: ${fmt(totalLoad - totalReaction)} kN`);

// Step 5: Global moment equilibrium about A
let momentAboutA = 0;
// Fixed moment reaction at A
const Ma = reactions[`SUPPORT${sA.id}`]?.momentReaction ?? 0;
momentAboutA += Ma;
// Rb
const Rb = reactions[`SUPPORT${sB.id}`]?.yReaction ?? 0;
momentAboutA += Rb * 6;  // Rb at x=6
// Rc
const Rc = reactions[`SUPPORT${sC.id}`]?.yReaction ?? 0;
momentAboutA += Rc * 18; // Rc at x=18
// Rd
const Rd = reactions[`SUPPORT${sD.id}`]?.yReaction ?? 0;
momentAboutA += Rd * 26; // Rd at x=26

// Load moments about A (downward = negative contribution to ACW moment sum):
// UDL 24kN/m on AB: resultant 144kN at x=3:  -144*3 = -432
// UDL 16kN/m on BC: resultant 192kN at x=12: -192*12 = -2304
// 80kN at x=12 (6m from B): -80*12 = -960
// 72kN at x=20 (2m from C): -72*20 = -1440
// 24kN at x=27.5 (at E):    -24*27.5 = -660
momentAboutA -= 144*3 + 192*12 + 80*12 + 72*20 + 24*27.5;

console.log(`\n--- Global Moment Equilibrium about A ---`);
console.log(`  Ma = ${fmt(Ma)}`);
console.log(`  Rb*6 = ${fmt(Rb*6)}`);
console.log(`  Rc*18 = ${fmt(Rc*18)}`);
console.log(`  Rd*26 = ${fmt(Rd*26)}`);
console.log(`  Load moments = -${432+2304+960+1440+660} = -${5796}`);
console.log(`  RESIDUAL = ${fmt(momentAboutA)} (should be ≈0)`);

// Step 6: Member-level reactions
console.log("\n--- Member-level Reactions ---");
const rAB = solver.updatedSolveReactions(spanAB);
const rBC = solver.updatedSolveReactions(spanBC);
const rCD = solver.updatedSolveReactions(spanCD);
const rDE = solver.updatedSolveReactions(spanDE);
console.log(`  AB: left=${fmt(rAB.leftReaction)}, right=${fmt(rAB.rightReaction)}`);
console.log(`  BC: left=${fmt(rBC.leftReaction)}, right=${fmt(rBC.rightReaction)}`);
console.log(`  CD: left=${fmt(rCD.leftReaction)}, right=${fmt(rCD.rightReaction)}`);
console.log(`  DE: left=${fmt(rDE.leftReaction)}, right=${fmt(rDE.rightReaction)}`);
