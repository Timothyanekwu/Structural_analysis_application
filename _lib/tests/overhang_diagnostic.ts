/**
 * Diagnostic script for overhanging beam bugs.
 * Tests various overhang configurations and reports results.
 */
import { BeamSolver } from "../beamSolver/beamSolver";
import { Beam } from "../elements/member";
import { PointLoad, UDL } from "../elements/load";
import { Node } from "../elements/node";
import { FixedSupport, PinnedSupport, RollerSupport } from "../elements/support";

function fmt(n: number) {
  return n.toFixed(6);
}

/** Test 1: Left overhang (free-pinned-roller) with PointLoad */
function testLeftOverhang() {
  console.log("=== Test 1: Left overhang (free-pinned-roller) with PointLoad ===");
  console.log("  A(free,0m) --- B(pinned,2m) === C(roller,8m)");
  console.log("  10kN at 1m from A on overhang AB");
  
  const sB = new PinnedSupport(2, 0);
  const sC = new RollerSupport(8, 0, sB);

  const nA = new Node("A", 0, 0);
  const nB = new Node("B", 2, 0, sB);
  const nC = new Node("C", 8, 0, sC);

  const overhang = new Beam(nA, nB, 0, 0, null, 1, 1);
  const mainSpan = new Beam(nB, nC, 0, 0, null, 1, 1);
  overhang.addLoad(new PointLoad(1, 10));

  const solver = new BeamSolver([overhang, mainSpan]);
  
  const moments = solver.updatedGetFinalMoments();
  console.log("\n  Node moments:");
  for (const m of moments) {
    console.log(`    Node ${m.nodeId}: left=${fmt(m.leftMoment)}, right=${fmt(m.rightMoment)}`);
  }
  
  const reactions = solver.updatedGetSupportReactions();
  console.log("\n  Support Reactions:");
  for (const [key, val] of Object.entries(reactions)) {
    console.log(`    ${key}: Fy=${fmt(val.yReaction)}`);
  }
  
  const expectedRb = 35/3;
  const expectedRc = -5/3;
  const actualRb = reactions[`SUPPORT${sB.id}`]?.yReaction ?? 0;
  const actualRc = reactions[`SUPPORT${sC.id}`]?.yReaction ?? 0;
  
  console.log(`\n  Expected: Rb=${fmt(expectedRb)}, Rc=${fmt(expectedRc)}`);
  console.log(`  Actual:   Rb=${fmt(actualRb)}, Rc=${fmt(actualRc)}`);
  console.log(`  Rb error: ${fmt(Math.abs(actualRb - expectedRb))}`);
  console.log(`  Rc error: ${fmt(Math.abs(actualRc - expectedRc))}`);
  
  // Also check internal forces on overhang member
  console.log("\n  Internal forces on overhang (A-B):");
  const overhangForces = solver.getInternalForceData(overhang, 0.5);
  for (const pt of overhangForces) {
    console.log(`    x=${fmt(pt.x)}: V=${fmt(pt.shear)}, M=${fmt(pt.moment)}`);
  }
  
  console.log("\n  Expected shear on overhang:");
  console.log("    x<1: V=0 (no support on left, no load yet)");
  console.log("    x>1: V=-10 (load acts downward)");
  console.log("  Expected moment: M(0)=0, M(1)=0, M(2)=-10");
}

/** Test 2: Right overhang (pinned-roller-free) with PointLoad */
function testRightOverhang() {
  console.log("\n\n=== Test 2: Right overhang (pinned-roller-free) with PointLoad ===");
  console.log("  A(pinned,0m) === B(roller,6m) --- C(free,8m)");
  console.log("  10kN at 1m from B on overhang BC");
  
  const sA = new PinnedSupport(0, 0);
  const sB = new RollerSupport(6, 0, sA);

  const nA = new Node("A", 0, 0, sA);
  const nB = new Node("B", 6, 0, sB);
  const nC = new Node("C", 8, 0);

  const mainSpan = new Beam(nA, nB, 0, 0, null, 1, 1);
  const overhang = new Beam(nB, nC, 0, 0, null, 1, 1);
  overhang.addLoad(new PointLoad(1, 10));

  const solver = new BeamSolver([mainSpan, overhang]);
  
  const moments = solver.updatedGetFinalMoments();
  console.log("\n  Node moments:");
  for (const m of moments) {
    console.log(`    Node ${m.nodeId}: left=${fmt(m.leftMoment)}, right=${fmt(m.rightMoment)}`);
  }
  
  const reactions = solver.updatedGetSupportReactions();
  console.log("\n  Support Reactions:");
  for (const [key, val] of Object.entries(reactions)) {
    console.log(`    ${key}: Fy=${fmt(val.yReaction)}`);
  }
  
  // Moment about A: Rb*6 = 10*7 → Rb = 70/6 = 35/3
  // Ra = 10 - 35/3 = -5/3
  const expectedRa = -5/3;
  const expectedRb = 35/3;
  const actualRa = reactions[`SUPPORT${sA.id}`]?.yReaction ?? 0;
  const actualRb = reactions[`SUPPORT${sB.id}`]?.yReaction ?? 0;
  
  console.log(`\n  Expected: Ra=${fmt(expectedRa)}, Rb=${fmt(expectedRb)}`);
  console.log(`  Actual:   Ra=${fmt(actualRa)}, Rb=${fmt(actualRb)}`);
  console.log(`  Ra error: ${fmt(Math.abs(actualRa - expectedRa))}`);
  console.log(`  Rb error: ${fmt(Math.abs(actualRb - expectedRb))}`);
  
  console.log("\n  Internal forces on overhang (B-C):");
  const overhangForces = solver.getInternalForceData(overhang, 0.5);
  for (const pt of overhangForces) {
    console.log(`    x=${fmt(pt.x)}: V=${fmt(pt.shear)}, M=${fmt(pt.moment)}`);
  }
  console.log("  Expected: At x=0 on overhang, V should be 0 (from right side, V builds from free end)");
  console.log("  From left-side cut: V(x) = leftReaction - loads_left_of_x");
  console.log("  leftReaction for overhang: should be the total load (10) since startNode has support and endNode is free? Or...");
  
  // Also check internal forces on main span
  console.log("\n  Internal forces on main span (A-B):");
  const mainForces = solver.getInternalForceData(mainSpan, 1.0);
  for (const pt of mainForces) {
    console.log(`    x=${fmt(pt.x)}: V=${fmt(pt.shear)}, M=${fmt(pt.moment)}`);
  }
}

/** Test 3: Right overhang with UDL */
function testRightOverhangUDL() {
  console.log("\n\n=== Test 3: Right overhang with UDL ===");
  console.log("  A(pinned,0m) === B(roller,6m) --- C(free,8m)");
  console.log("  UDL 10kN/m on overhang BC");
  
  const sA = new PinnedSupport(0, 0);
  const sB = new RollerSupport(6, 0, sA);

  const nA = new Node("A", 0, 0, sA);
  const nB = new Node("B", 6, 0, sB);
  const nC = new Node("C", 8, 0);

  const mainSpan = new Beam(nA, nB, 0, 0, null, 1, 1);
  const overhang = new Beam(nB, nC, 0, 0, null, 1, 1);
  overhang.addLoad(new UDL(0, 2, 10));

  const solver = new BeamSolver([mainSpan, overhang]);
  
  const reactions = solver.updatedGetSupportReactions();
  console.log("\n  Support Reactions:");
  for (const [key, val] of Object.entries(reactions)) {
    console.log(`    ${key}: Fy=${fmt(val.yReaction)}`);
  }
  
  // Total load = 20kN at centroid 1m from B (x=7)
  // Moment about A: Rb*6 = 20*7 → Rb = 140/6 = 70/3
  // Ra = 20 - 70/3 = -10/3
  console.log(`\n  Expected: Ra=${fmt(-10/3)}, Rb=${fmt(70/3)}`);
  const actualRa = reactions[`SUPPORT${sA.id}`]?.yReaction ?? 0;
  const actualRb = reactions[`SUPPORT${sB.id}`]?.yReaction ?? 0;
  console.log(`  Actual:   Ra=${fmt(actualRa)}, Rb=${fmt(actualRb)}`);
}

/** Test 4: Left overhang, load on main span too */
function testLeftOverhangMainSpanLoaded() {
  console.log("\n\n=== Test 4: Left overhang + loaded main span ===");
  console.log("  A(free,0m) --- B(pinned,3m) === C(roller,9m)");
  console.log("  20kN at 1.5m on AB, UDL 10kN/m on BC");
  
  const sB = new PinnedSupport(3, 0);
  const sC = new RollerSupport(9, 0, sB);

  const nA = new Node("A", 0, 0);
  const nB = new Node("B", 3, 0, sB);
  const nC = new Node("C", 9, 0, sC);

  const overhang = new Beam(nA, nB, 0, 0, null, 1, 1);
  const mainSpan = new Beam(nB, nC, 0, 0, null, 1, 1);
  overhang.addLoad(new PointLoad(1.5, 20));  // 20kN at midpoint of overhang
  mainSpan.addLoad(new UDL(0, 6, 10));       // 10kN/m over full main span

  const solver = new BeamSolver([overhang, mainSpan]);
  
  const reactions = solver.updatedGetSupportReactions();
  console.log("\n  Support Reactions:");
  for (const [key, val] of Object.entries(reactions)) {
    console.log(`    ${key}: Fy=${fmt(val.yReaction)}`);
  }
  
  // Overhang transfer: M_B_from_overhang = -20*(3-1.5) = -30kNm (hogging at B)
  // This moment from overhang acts on the main span.
  // For main span B-C (length 6m):
  //   Simply supported reactions from UDL: Rb_udl = Rc_udl = 10*6/2 = 30kN each
  //   But we also have the overhang moment of -30kNm at B.
  //   Moment about C: Rb_ms*6 - 10*6*3 + 30 = 0 → Rb_ms = (180-30)/6 = 25
  //   Rc = 60 - 25 = 35
  // From overhang: Rb_ovh contributes 20kN (all load goes to B since A is free)
  // Total Rb = 25 + 20 = 45
  // Total Rc = 35
  // Total = 45 + 35 = 80 = 20 + 60 ✓
  
  const totalLoad = 20 + 10*6;
  let totalReaction = 0;
  for (const r of Object.values(reactions)) {
    totalReaction += r.yReaction;
  }
  console.log(`\n  Equilibrium: Total load=${totalLoad}, Total reaction=${fmt(totalReaction)}, Diff=${fmt(totalLoad - totalReaction)}`);
  console.log(`  Expected: Rb≈45, Rc≈35`);
}

testLeftOverhang();
testRightOverhang();
testRightOverhangUDL();
testLeftOverhangMainSpanLoaded();
