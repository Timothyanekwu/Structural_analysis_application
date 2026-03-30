/**
 * Diagnostic: Indeterminate beams with overhanging members.
 * These are the cases most likely to expose bugs in slope-deflection handling.
 */
import { BeamSolver } from "../beamSolver/beamSolver";
import { Beam } from "../elements/member";
import { PointLoad, UDL } from "../elements/load";
import { Node } from "../elements/node";
import { FixedSupport, PinnedSupport, RollerSupport } from "../elements/support";

function fmt(n: number) { return n.toFixed(4); }

/**
 * Test A: Propped cantilever with right overhang
 *   A(fixed,0) ========== B(roller,4) ---------- C(free,6)
 *   UDL 10kN/m over full length of A-B
 *   20kN point load at C (position 2m from B on overhang)
 */
function testA_proppedCantileverWithOverhang() {
  console.log("=== Test A: Propped cantilever with right overhang ===");
  console.log("  A(fixed,0) ========== B(roller,4) --- C(free,6)");
  console.log("  UDL 10kN/m on AB, 20kN at 2m from B on BC");

  const sA = new FixedSupport(0, 0);
  const sB = new RollerSupport(4, 0, sA);

  const nA = new Node("A", 0, 0, sA);
  const nB = new Node("B", 4, 0, sB);
  const nC = new Node("C", 6, 0);

  const span = new Beam(nA, nB, 0, 0, null, 1, 1);
  const overhang = new Beam(nB, nC, 0, 0, null, 1, 1);
  span.addLoad(new UDL(0, 4, 10));
  overhang.addLoad(new PointLoad(2, 20));

  const solver = new BeamSolver([span, overhang]);
  const moments = solver.updatedGetFinalMoments();
  const reactions = solver.updatedGetSupportReactions();

  console.log("\n  Node moments:");
  for (const m of moments) {
    console.log(`    Node ${m.nodeId}: left=${fmt(m.leftMoment)}, right=${fmt(m.rightMoment)}`);
  }
  console.log("\n  Support Reactions:");
  for (const [key, val] of Object.entries(reactions)) {
    console.log(`    ${key}: Fy=${fmt(val.yReaction)}, M=${fmt(val.momentReaction)}`);
  }

  // Equilibrium check
  const totalLoad = 10*4 + 20;
  let totalReaction = 0;
  for (const r of Object.values(reactions)) totalReaction += r.yReaction;
  console.log(`\n  Equilibrium: load=${totalLoad}, reaction=${fmt(totalReaction)}, diff=${fmt(totalLoad-totalReaction)}`);

  // The moment at B from the overhang = 20*2 = 40 kNm (hogging, clockwise)
  // For the propped cantilever A-B with UDL and known moment at B:
  // Using compatibility or slope-deflection:
  //   Since A is fixed: θ_A = 0
  //   Since B is roller (terminal at B for span direction): use modified SDE
  //   M_AB = FEM_AB - FEM_BA/2 + 3EI/L * θ_A ... but θ_A =0 since fixed
  //   Wait, B is NOT terminal (has 2 members). So the full SDE applies.
  //   But θ_A = 0 (fixed), so:
  //   M_AB = FEM_AB + (2EI/L)(2*0 + θ_B) + ... = FEM_AB + (2EI/L)*θ_B
  //   M_BA = FEM_BA + (2EI/L)(2*θ_B + 0) = FEM_BA + (4EI/L)*θ_B
  //   At B: M_BA + M_overhang = 0  (moment equilibrium)
  //   M_overhang = -40 (clockwise = negative in anticlockwise-positive convention)
  //   M_BA - 40 = 0 → M_BA = 40
  //   
  //   FEM_AB = wL²/12 = 10*16/12 = 13.333
  //   FEM_BA = -wL²/12 = -13.333
  //   M_BA = -13.333 + (4EI/4)*θ_B = -13.333 + EI*θ_B = 40
  //   → EI*θ_B = 53.333 → θ_B = 53.333/EI
  //   M_AB = 13.333 + (2*1*1/4)*53.333 = 13.333 + 0.5*53.333 = 13.333 + 26.667 = 40.0
  //   
  //   Hmm wait, let me redo. E=1, I=1, L=4:
  //   M_AB = FEM_AB + (2EI/L)(2θ_A + θ_B) = 13.333 + (2/4)(0 + θ_B) = 13.333 + 0.5θ_B
  //   M_BA = FEM_BA + (2EI/L)(2θ_B + θ_A) = -13.333 + (2/4)(2θ_B) = -13.333 + θ_B
  //   
  //   Equilibrium at B: M_BA + M_overhang_at_B = 0
  //   M_overhang at B = +40 (the static moment from overhang, anticlockwise from B's perspective)
  //   Wait, the overhang load creates a clockwise moment at B when viewed from B.
  //   20kN at 2m from B creates moment = -20*2 = -40kNm at B (clockwise/hogging)
  //   So: M_BA + (-40) = 0 → M_BA = 40
  //   → -13.333 + θ_B = 40 → θ_B = 53.333
  //   M_AB = 13.333 + 0.5*53.333 = 40.0
  //   
  //   Now reactions for span A-B:
  //   Total load on AB = 40kN (UDL)
  //   Rb_AB = (40*2 - 40.0 - (-40.0))/4 ... wait let me use the formula:
  //   rightReaction = (loadMoments - leftMoment - rightMoment) / L
  //   loadMoments from AB = 40*2 = 80 (resultant at centroid = 2m)
  //   leftMoment = A.rightMoment = M_AB
  //   rightMoment = B.leftMoment = M_BA  
  //   
  //   Hmm, let me check what A.rightMoment and B.leftMoment mean.
  //   A.rightMoment is the moment from the antiClk side at A = M_AB (slope-deflection M from A looking right)
  //   B.leftMoment is the moment from the clk side at B = M_BA (slope-deflection M from B looking left)
  //   
  //   rightReaction_AB = (80 - M_AB - M_BA)/4 = (80 - 40.0 - 40.0)/4 = 0/4 = 0??
  //   That can't be right...
  //   
  //   Actually wait, I think I messed up the sign convention. Let me check:
  //   FEM_AB (start) = wab²/L² for UDL = wL²/12 (positive = anticlockwise)
  //   FEM_BA (end)   = -wL²/12 (negative = clockwise)
  //   getFixedEndMoment returns these with proper signs.

  console.log("\n  Computing expected values...");
  console.log("  For span A-B with L=4, UDL 10kN/m:");
  console.log("    FEM_AB (start) = wL²/12 = " + fmt(10*16/12));
  console.log("    FEM_BA (end)   = -wL²/12 = " + fmt(-10*16/12));
}

/**
 * Test B: Two-span continuous beam with left overhang
 *   D(free,0) --- A(pinned,2) ========== B(roller,8) ========== C(fixed,14)
 *   10kN at 1m from D on overhang, UDL 5kN/m on AB and BC
 */
function testB_continuousWithLeftOverhang() {
  console.log("\n\n=== Test B: Continuous beam with left overhang ===");
  console.log("  D(free,0) --- A(pinned,2) ========== B(roller,8) ========== C(fixed,14)");
  console.log("  10kN at 1m on DA, UDL 5kN/m on AB and BC");

  const sA = new PinnedSupport(2, 0);
  const sB = new RollerSupport(8, 0, sA);
  const sC = new FixedSupport(14, 0, sB);

  const nD = new Node("D", 0, 0);
  const nA = new Node("A", 2, 0, sA);
  const nB = new Node("B", 8, 0, sB);
  const nC = new Node("C", 14, 0, sC);

  const overhang = new Beam(nD, nA, 0, 0, null, 1, 1);
  const span1 = new Beam(nA, nB, 0, 0, null, 1, 1);
  const span2 = new Beam(nB, nC, 0, 0, null, 1, 1);
  overhang.addLoad(new PointLoad(1, 10));
  span1.addLoad(new UDL(0, 6, 5));
  span2.addLoad(new UDL(0, 6, 5));

  const solver = new BeamSolver([overhang, span1, span2]);
  const moments = solver.updatedGetFinalMoments();
  const reactions = solver.updatedGetSupportReactions();

  console.log("\n  Node moments:");
  for (const m of moments) {
    console.log(`    Node ${m.nodeId}: left=${fmt(m.leftMoment)}, right=${fmt(m.rightMoment)}`);
  }
  console.log("\n  Support Reactions:");
  for (const [key, val] of Object.entries(reactions)) {
    console.log(`    ${key}: Fy=${fmt(val.yReaction)}, M=${fmt(val.momentReaction)}`);
  }

  const totalLoad = 10 + 5*6 + 5*6;
  let totalReaction = 0;
  for (const r of Object.values(reactions)) totalReaction += r.yReaction;
  console.log(`\n  Equilibrium: load=${totalLoad}, reaction=${fmt(totalReaction)}, diff=${fmt(totalLoad-totalReaction)}`);

  // The moment at A from overhang = -10*(2-1) = -10 kNm
  console.log("  Expected moment at A from overhang: -10 kNm");
}

/**
 * Test C: Fixed-roller with both sides overhanging
 *   E(free,0) --- A(fixed,3) ========== B(roller,9) --- F(free,12)
 *   UDL 10kN/m on entire overhang E-A (3m)
 *   20kN at 2m from B on overhang B-F 
 */
function testC_bothSidesOverhang() {
  console.log("\n\n=== Test C: Fixed-roller with overhangs on both sides ===");
  console.log("  E(free,0) --- A(fixed,3) ========== B(roller,9) --- F(free,12)");
  console.log("  UDL 10kN/m on EA, 20kN at 2m from B on BF");

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
  const moments = solver.updatedGetFinalMoments();
  const reactions = solver.updatedGetSupportReactions();

  console.log("\n  Node moments:");
  for (const m of moments) {
    console.log(`    Node ${m.nodeId}: left=${fmt(m.leftMoment)}, right=${fmt(m.rightMoment)}`);
  }
  console.log("\n  Support Reactions:");
  for (const [key, val] of Object.entries(reactions)) {
    console.log(`    ${key}: Fy=${fmt(val.yReaction)}, M=${fmt(val.momentReaction)}`);
  }

  const totalLoad = 10*3 + 20;
  let totalReaction = 0;
  for (const r of Object.values(reactions)) totalReaction += r.yReaction;
  console.log(`\n  Equilibrium: load=${totalLoad}, reaction=${fmt(totalReaction)}, diff=${fmt(totalLoad-totalReaction)}`);
  
  // Overhang contributions:
  // Left overhang at A: moment = -10*3*(3/2) = -45 kNm (from UDL), reaction = 30kN
  // Right overhang at B: moment = -20*2 = -40 kNm, reaction = 20kN
  // 
  // For the main span A-B (no loads on it, but end moments from overhangs):
  // A is fixed, B is roller (terminal for main span).
  // But B is NOT terminal overall (2 members: mainSpan + rightOvh).
  // So the FULL slope-deflection equation applies.
  // 
  // θ_A = 0 (fixed)
  // M_AB = 0 + (2EI/6)(0 + θ_B) = θ_B/3
  // M_BA = 0 + (2EI/6)(2θ_B + 0) = 2θ_B/3
  // 
  // At A: M_AB + M_leftOvh = momentReaction_A → since fixed, the extra becomes the reaction
  // But actually for the equilibrium equation (from updatedGetEquations):
  //   A is filtered out (fixed support), so no equation for A.
  // At B: M_BA + M_rightOvh = 0 (roller, moment must be zero)
  //   2θ_B/3 + (-40) = 0 → θ_B = 60
  //   M_BA = 2*60/3 = 40
  //   M_AB = 60/3 = 20
  //
  // Now at A:
  //   A.leftMoment = moment from left overhang = -45 (looking toward E)
  //   A.rightMoment = M_AB = 20 (looking toward B)
  //   Fixed support moment reaction = A.leftMoment + A.rightMoment + node.momentLoad
  //                                 = -45 + 20 + 0 = -25
  //
  // Reactions:
  //   Main span (no loads): 
  //     rightReaction = (0 - M_AB - M_BA)/6 = (0 - 20 - 40)/6 = -60/6 = -10
  //     leftReaction = 0 - (-10) = 10
  //   Left overhang: rightReaction = 30 (all load to A)
  //   Right overhang: leftReaction = 20 (all load to B)
  //
  //   Total at A = 30 + 10 = 40... wait: leftOvh rightReaction=30, mainSpan leftReaction=10
  //               Actually, for the mainSpan: A is the startNode, B is endNode.
  //               leftReaction is at A, rightReaction is at B.
  //   Total at A = leftOvh.rightReaction + mainSpan.leftReaction = 30 + 10 = 40
  //   Total at B = mainSpan.rightReaction + rightOvh.leftReaction = -10 + 20 = 10
  //   Total = 40 + 10 = 50 = 30 + 20 ✓
  
  console.log("\n  Expected: Ra=40, Ma=-25, Rb=10");
  
  // Also check internal forces
  console.log("\n  Internal forces on main span (A-B, no loads):");
  const mainForces = solver.getInternalForceData(mainSpan, 1.0);
  for (const pt of mainForces) {
    console.log(`    x=${fmt(pt.x)}: V=${fmt(pt.shear)}, M=${fmt(pt.moment)}`);
  }
  console.log("\n  Internal forces on left overhang (E-A):");
  const leftForces = solver.getInternalForceData(leftOvh, 0.5);
  for (const pt of leftForces) {
    console.log(`    x=${fmt(pt.x)}: V=${fmt(pt.shear)}, M=${fmt(pt.moment)}`);
  }
  console.log("\n  Internal forces on right overhang (B-F):");
  const rightForces = solver.getInternalForceData(rightOvh, 0.5);
  for (const pt of rightForces) {
    console.log(`    x=${fmt(pt.x)}: V=${fmt(pt.shear)}, M=${fmt(pt.moment)}`);
  }
}

/**
 * Test D: Simple case that's known to fail — check equation generation
 *   A(free) --- B(roller) ========== C(roller) --- D(free)
 *   Load on left overhang only
 */
function testD_doubleOverhangRollerRoller() {
  console.log("\n\n=== Test D: Double overhang roller-roller ===");
  console.log("  A(free,0) --- B(roller,3) === C(roller,9) --- D(free,12)");
  console.log("  10kN at 1.5m on AB overhang");

  const sB = new RollerSupport(3, 0);
  const sC = new RollerSupport(9, 0, sB);

  const nA = new Node("A", 0, 0);
  const nB = new Node("B", 3, 0, sB);
  const nC = new Node("C", 9, 0, sC);
  const nD = new Node("D", 12, 0);

  const leftOvh = new Beam(nA, nB, 0, 0, null, 1, 1);
  const mainSpan = new Beam(nB, nC, 0, 0, null, 1, 1);
  const rightOvh = new Beam(nC, nD, 0, 0, null, 1, 1);
  leftOvh.addLoad(new PointLoad(1.5, 10));

  const solver = new BeamSolver([leftOvh, mainSpan, rightOvh]);
  
  try {
    const moments = solver.updatedGetFinalMoments();
    const reactions = solver.updatedGetSupportReactions();

    console.log("\n  Node moments:");
    for (const m of moments) {
      console.log(`    Node ${m.nodeId}: left=${fmt(m.leftMoment)}, right=${fmt(m.rightMoment)}`);
    }
    console.log("\n  Support Reactions:");
    for (const [key, val] of Object.entries(reactions)) {
      console.log(`    ${key}: Fy=${fmt(val.yReaction)}, M=${fmt(val.momentReaction)}`);
    }

    const totalLoad = 10;
    let totalReaction = 0;
    for (const r of Object.values(reactions)) totalReaction += r.yReaction;
    console.log(`\n  Equilibrium: load=${totalLoad}, reaction=${fmt(totalReaction)}, diff=${fmt(totalLoad-totalReaction)}`);

    // Expected by statics:
    // Moment about C: Rb*6 = 10*(9-1.5) = 75 → Rb = 12.5
    // Rc = 10 - 12.5 = -2.5
    console.log("  Expected: Rb=12.5, Rc=-2.5");
  } catch (e: any) {
    console.log("  ERROR: " + e.message);
  }
}

/**
 * Test E: Indeterminate with overhang and load on main span
 *   A(free,0) --- B(fixed,3) ========== C(pinned,9) --- D(free,12)
 *   15kN at 1m on AB, UDL 8kN/m on BC, 10kN at 2m on CD
 */
function testE_complexOverhang() {
  console.log("\n\n=== Test E: Complex indeterminate with overhangs on both sides ===");
  console.log("  A(free,0) --- B(fixed,3) === C(pinned,9) --- D(free,12)");
  console.log("  15kN at 1m on AB, UDL 8kN/m on BC, 10kN at 2m on CD");

  const sB = new FixedSupport(3, 0);
  const sC = new PinnedSupport(9, 0, sB);

  const nA = new Node("A", 0, 0);
  const nB = new Node("B", 3, 0, sB);
  const nC = new Node("C", 9, 0, sC);
  const nD = new Node("D", 12, 0);

  const leftOvh = new Beam(nA, nB, 0, 0, null, 1, 1);
  const mainSpan = new Beam(nB, nC, 0, 0, null, 1, 1);
  const rightOvh = new Beam(nC, nD, 0, 0, null, 1, 1);
  leftOvh.addLoad(new PointLoad(1, 15));
  mainSpan.addLoad(new UDL(0, 6, 8));
  rightOvh.addLoad(new PointLoad(2, 10));

  const solver = new BeamSolver([leftOvh, mainSpan, rightOvh]);
  
  try {
    const moments = solver.updatedGetFinalMoments();
    const reactions = solver.updatedGetSupportReactions();

    console.log("\n  Node moments:");
    for (const m of moments) {
      console.log(`    Node ${m.nodeId}: left=${fmt(m.leftMoment)}, right=${fmt(m.rightMoment)}`);
    }
    console.log("\n  Support Reactions:");
    for (const [key, val] of Object.entries(reactions)) {
      console.log(`    ${key}: Fy=${fmt(val.yReaction)}, M=${fmt(val.momentReaction)}`);
    }

    const totalLoad = 15 + 8*6 + 10;
    let totalReaction = 0;
    for (const r of Object.values(reactions)) totalReaction += r.yReaction;
    console.log(`\n  Equilibrium: load=${totalLoad}, reaction=${fmt(totalReaction)}, diff=${fmt(totalLoad-totalReaction)}`);
  } catch (e: any) {
    console.log("  ERROR: " + e.message);
  }
}

testA_proppedCantileverWithOverhang();
testB_continuousWithLeftOverhang();
testC_bothSidesOverhang();
testD_doubleOverhangRollerRoller();
testE_complexOverhang();
