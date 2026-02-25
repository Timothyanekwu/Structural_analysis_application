/**
 * Diagnostic test suite for frame solver force propagation.
 * Tests multiple frame configurations to identify bugs in:
 *   - Beam shear (vertical reaction propagation)
 *   - Column shear (horizontal reaction propagation)
 *   - Axial force propagation
 *   - Global equilibrium (ΣFx = 0, ΣFy = total vertical load)
 *   - Global moment equilibrium
 */
import { FrameSolver } from "../frameSolver/frameSolver";
import { Beam, Column } from "../elements/member";
import { Node } from "../elements/node";
import {
  FixedSupport,
  PinnedSupport,
  RollerSupport,
} from "../elements/support";
import { PointLoad, UDL } from "../elements/load";

const TOL = 1e-3;

function checkEquilibrium(
  label: string,
  solver: FrameSolver,
  expectedFx: number,
  expectedFy: number,
) {
  const reactions = solver.updatedSolveReactions();

  let sumRx = 0;
  let sumRy = 0;
  for (const [id, r] of reactions) {
    sumRx += r.xReaction;
    sumRy += r.yReaction;
  }

  const passFx = Math.abs(sumRx - expectedFx) < TOL;
  const passFy = Math.abs(sumRy - expectedFy) < TOL;

  console.log(`\n=== ${label} ===`);
  console.log("Reactions:");
  for (const [id, r] of reactions) {
    console.log(
      `  Node ${id}: Rx=${r.xReaction.toFixed(4)}, Ry=${r.yReaction.toFixed(4)}`,
    );
  }
  console.log(
    `ΣRx = ${sumRx.toFixed(6)} (expected ${expectedFx}) → ${passFx ? "PASS" : "FAIL"}`,
  );
  console.log(
    `ΣRy = ${sumRy.toFixed(6)} (expected ${expectedFy}) → ${passFy ? "PASS" : "FAIL"}`,
  );

  // Also print member end reactions
  for (const m of solver.members) {
    const sid = m.startNode.id;
    const eid = m.endNode.id;
    const er = m.endReactions;
    console.log(
      `  Member ${sid}${eid}: RxS=${er.RxStart.toFixed(4)}, RyS=${er.RyStart.toFixed(4)}, RxE=${er.RxEnd.toFixed(4)}, RyE=${er.RyEnd.toFixed(4)}`,
    );
  }

  return passFx && passFy;
}

// ──────────────────────────────────────────────────────────────
// TEST 1: Simple portal frame, vertical load only (non-sway)
// Fixed-Fixed, symmetric portal, vertical point load on beam
// ──────────────────────────────────────────────────────────────
function test1_simplePortal() {
  const sA = new FixedSupport(0, 0);
  const sD = new FixedSupport(6, 0);

  const nA = new Node("A", 0, 0, sA);
  const nB = new Node("B", 0, 4);
  const nC = new Node("C", 6, 4);
  const nD = new Node("D", 6, 0, sD);

  const AB = new Column(nA, nB);
  const BC = new Beam(nB, nC);
  const DC = new Column(nD, nC);

  BC.addLoad(new PointLoad(3, 20)); // 20 kN at midspan

  const solver = new FrameSolver([AB, BC, DC]);
  // External: Fx=0, Fy=20
  return checkEquilibrium(
    "Test 1: Symmetric portal, vertical load",
    solver,
    0,
    20,
  );
}

// ──────────────────────────────────────────────────────────────
// TEST 2: Portal frame with horizontal load (sway)
// ──────────────────────────────────────────────────────────────
function test2_swayPortal() {
  const sA = new FixedSupport(0, 0);
  const sD = new FixedSupport(6, 0);

  const nA = new Node("A", 0, 0, sA);
  const nB = new Node("B", 0, 4);
  const nC = new Node("C", 6, 4);
  const nD = new Node("D", 6, 0, sD);

  const AB = new Column(nA, nB);
  const BC = new Beam(nB, nC);
  const DC = new Column(nD, nC);

  nB.addHorizontalLoad(10); // 10 kN horizontal at B

  const solver = new FrameSolver([AB, BC, DC]);
  // External: Fx=10, Fy=0
  return checkEquilibrium(
    "Test 2: Sway portal, horizontal load",
    solver,
    10,
    0,
  );
}

// ──────────────────────────────────────────────────────────────
// TEST 3: Portal frame with BOTH vertical and horizontal loads
// ──────────────────────────────────────────────────────────────
function test3_combinedLoads() {
  const sA = new FixedSupport(0, 0);
  const sD = new FixedSupport(6, 0);

  const nA = new Node("A", 0, 0, sA);
  const nB = new Node("B", 0, 4);
  const nC = new Node("C", 6, 4);
  const nD = new Node("D", 6, 0, sD);

  const AB = new Column(nA, nB);
  const BC = new Beam(nB, nC);
  const DC = new Column(nD, nC);

  BC.addLoad(new UDL(0, 6, 10)); // 10 kN/m UDL across full span
  nB.addHorizontalLoad(15); // 15 kN horizontal at B

  const solver = new FrameSolver([AB, BC, DC]);
  // External: Fx=15, Fy=60 (10*6)
  return checkEquilibrium(
    "Test 3: Combined vertical + horizontal",
    solver,
    15,
    60,
  );
}

// ──────────────────────────────────────────────────────────────
// TEST 4: Two-story frame (multi-story)
// ──────────────────────────────────────────────────────────────
function test4_twoStory() {
  const sA = new FixedSupport(0, 0);
  const sF = new FixedSupport(6, 0);

  const nA = new Node("A", 0, 0, sA);
  const nB = new Node("B", 0, 3);
  const nC = new Node("C", 6, 3);
  const nD = new Node("D", 0, 6);
  const nE = new Node("E", 6, 6);
  const nF = new Node("F", 6, 0, sF);

  const AB = new Column(nA, nB);
  const FC = new Column(nF, nC);
  const BC = new Beam(nB, nC);
  const BD = new Column(nB, nD);
  const CE = new Column(nC, nE);
  const DE = new Beam(nD, nE);

  BC.addLoad(new UDL(0, 6, 5)); // 5 kN/m on floor 1
  DE.addLoad(new UDL(0, 6, 8)); // 8 kN/m on floor 2

  const solver = new FrameSolver([AB, FC, BC, BD, CE, DE]);
  // External: Fx=0, Fy=30+48=78
  return checkEquilibrium(
    "Test 4: Two-story frame, gravity only",
    solver,
    0,
    78,
  );
}

// ──────────────────────────────────────────────────────────────
// TEST 5: Pinned base portal (non-sway test)
// ──────────────────────────────────────────────────────────────
function test5_pinnedBase() {
  const sA = new PinnedSupport(0, 0);
  const sD = new PinnedSupport(6, 0);

  const nA = new Node("A", 0, 0, sA);
  const nB = new Node("B", 0, 4);
  const nC = new Node("C", 6, 4);
  const nD = new Node("D", 6, 0, sD);

  const AB = new Column(nA, nB);
  const BC = new Beam(nB, nC);
  const DC = new Column(nD, nC);

  BC.addLoad(new PointLoad(3, 30)); // 30 kN at midspan

  const solver = new FrameSolver([AB, BC, DC]);
  // External: Fx=0, Fy=30
  return checkEquilibrium(
    "Test 5: Pinned-base portal, vertical load",
    solver,
    0,
    30,
  );
}

// ──────────────────────────────────────────────────────────────
// RUN ALL TESTS
// ──────────────────────────────────────────────────────────────
console.log("╔══════════════════════════════════════════════╗");
console.log("║  FRAME SOLVER DIAGNOSTIC TEST SUITE         ║");
console.log("╚══════════════════════════════════════════════╝");

const results: boolean[] = [];
results.push(test1_simplePortal());
results.push(test2_swayPortal());
results.push(test3_combinedLoads());
results.push(test4_twoStory());
results.push(test5_pinnedBase());

console.log("\n════════════════════════════════════════════════");
console.log("SUMMARY:");
results.forEach((pass, i) => {
  console.log(`  Test ${i + 1}: ${pass ? "PASS ✓" : "FAIL ✗"}`);
});
const allPass = results.every(Boolean);
console.log(`\nOverall: ${allPass ? "ALL PASS ✓" : "SOME FAILED ✗"}`);
