/**
 * Deeper diagnostic for Test 4 — combined overhang + loaded main span.
 * Focus on memberEndReactions and moment distribution.
 */
import { BeamSolver } from "../beamSolver/beamSolver";
import { Beam } from "../elements/member";
import { PointLoad, UDL } from "../elements/load";
import { Node } from "../elements/node";
import { PinnedSupport, RollerSupport } from "../elements/support";

function fmt(n: number) { return n.toFixed(6); }

// Test 4: Left overhang + loaded main span
//   A(free,0m) --- B(pinned,3m) === C(roller,9m)
//   20kN at 1.5m on AB, UDL 10kN/m on BC

const sB = new PinnedSupport(3, 0);
const sC = new RollerSupport(9, 0, sB);

const nA = new Node("A", 0, 0);
const nB = new Node("B", 3, 0, sB);
const nC = new Node("C", 9, 0, sC);

const overhang = new Beam(nA, nB, 0, 0, null, 1, 1);
const mainSpan = new Beam(nB, nC, 0, 0, null, 1, 1);
overhang.addLoad(new PointLoad(1.5, 20));
mainSpan.addLoad(new UDL(0, 6, 10));

const solver = new BeamSolver([overhang, mainSpan]);

// Get moments
const moments = solver.updatedGetFinalMoments();
console.log("Node moments:");
for (const m of moments) {
  console.log(`  Node ${m.nodeId}: left=${fmt(m.leftMoment)}, right=${fmt(m.rightMoment)}`);
}

// Moment at B from overhang:
// The overhang load 20kN at 1.5m from A creates moment at B:
// M_B = -20*(3-1.5) = -30kNm (hogging)
// So: node B should have leftMoment from overhang = -30 (i.e., moment transmitted from overhang to B)
// From slope-deflection: since B is pinned-terminal for the overhang member...
// Actually B is NOT terminal for pinned — B has TWO connected members (overhang + mainSpan)
// So B is NOT terminal. Check isTrmnlNode.

console.log("\nNode B connectedMembers:");
for (const cm of nB.connectedMembers) {
  console.log(`  Member ${cm.member.startNode.id}-${cm.member.endNode.id}, isStart=${cm.isStart}`);
}
console.log(`  isTrmnlNode(B) for beam members: ${nB.connectedMembers.filter(m => m.member instanceof Beam).length <= 1}`);

console.log("\nSolver reactions:");
const reactions = solver.updatedGetSupportReactions();
for (const [key, val] of Object.entries(reactions)) {
  console.log(`  ${key}: Fy=${fmt(val.yReaction)}`);
}

// Let's also manually compute what memberEndReactions gives for each member
console.log("\nMember-level reactions:");
const r1 = solver.updatedSolveReactions(overhang);
console.log(`  Overhang (A-B): left=${fmt(r1.leftReaction)}, right=${fmt(r1.rightReaction)}`);
const r2 = solver.updatedSolveReactions(mainSpan);
console.log(`  MainSpan (B-C): left=${fmt(r2.leftReaction)}, right=${fmt(r2.rightReaction)}`);

// Expected for overhang:
//   A is free, B has support → leftReaction = totalLoads (all goes to the supported end)
//   BUT the code checks: member.startNode.support && !member.endNode.support → leftReaction = totalLoads
//              AND: !member.startNode.support && member.endNode.support → rightReaction = totalLoads
//   Overhang: startNode = A (no support), endNode = B (support)
//   So: rightReaction = totalLoads = 20. leftReaction = 0
//   This is CORRECT for the vertical reaction from the overhang.
console.log("\n  Expected overhang reactions: left=0, right=20");

// Expected for mainSpan (B-C, both have supports):
//   loads = UDL 10kN/m over 6m → equivalent point load 60kN at centroid 3m
//   leftMoment = node B rightMoment, rightMoment = node C leftMoment
//   
//   From moments: let's check what the slope-deflection gives
//   Since B is NOT terminal (2 members connect), and both B and C are pinned/roller...
//   B has a pinned support but is NOT terminal → it should use the full 4EI/L, 2EI/L slope-deflection
//   C is roller and IS terminal → modified slope-deflection (3EI/L) applies for main span from B's perspective

// For the main span: rightReaction = (loadMoments - leftMoment - rightMoment) / L
// Let's see what loadMoments is: 60 * 3 = 180
// leftMoment = what's stored in node B rightMoment (from updatedGetFinalMoments)
// rightMoment = what's stored in node C leftMoment

const bMoments = moments.find(m => m.nodeId === "B");
const cMoments = moments.find(m => m.nodeId === "C");
console.log(`\n  MainSpan moment extraction: B.rightMoment=${fmt(bMoments?.rightMoment ?? 0)}, C.leftMoment=${fmt(cMoments?.leftMoment ?? 0)}`);

// HERE IS THE KEY INSIGHT:
// Node B's rightMoment should represent the moment from the slope-deflection equation 
// for the main span (B→C direction).
// Node B's leftMoment should represent the moment from the slope-deflection equation
// for the overhang (looking toward A direction).
//
// For the overhang (A-B): Since A is free and B has a support:
//   The code goes to the "isFreeNode" branch which calculates momtAbtNode
//   momtAbtNode(overhang, B) = -1 * sum of [load.magnitude * (endNode.length - load.position)]
//                             = -1 * [20 * (2 - 1.5)]  ... wait, member length is 3
//                             = -1 * [20 * (3 - 1.5)] = -1 * 30 = -30
//
// So the overhang contributes leftMoment = -30 at B.
// But wait — the slope-deflection equation for the overhang stores this in `clk` (clockwise)
// at B since B is endNode of overhang.
// clk[MOMENT_BA] = [{name: "c", coefficient: -30}, ...]

// For the main span (B-C): B is startNode.
// Since B is NOT terminal (has 2 members), and C IS terminal with roller/pinned...
// The code uses the modified 3EI/L branch.
// FEM_BC (start) = w*a*b^2/L^2 for equivalent loads... but actually uses general formula.
//
// The moment at B from the main span is stored in antiClk[MOMENT_BC].

// When computing memberEndReactions for main span:
// getMemberEndMoments gives:
//   leftMoment = B.rightMoment (the antiClk moment from B's perspective)
//   rightMoment = C.leftMoment (the clk moment from C's perspective)
//
// Then: rightReaction = (loadMoments - leftMoment - rightMoment) / L
//       leftReaction = totalLoads - rightReaction

console.log("\n\nMANUAL VERIFICATION of main span reactions:");
const loadMoments_mainSpan = 60 * 3; // UDL resultant * centroid position
const leftMoment_mainSpan = bMoments?.rightMoment ?? 0;
const rightMoment_mainSpan = cMoments?.leftMoment ?? 0;
const L_mainSpan = 6;

const rightReaction_manual = (loadMoments_mainSpan - leftMoment_mainSpan - rightMoment_mainSpan) / L_mainSpan;
const leftReaction_manual = 60 - rightReaction_manual;

console.log(`  loadMoments = ${loadMoments_mainSpan}`);
console.log(`  leftMoment (B.rightMoment) = ${fmt(leftMoment_mainSpan)}`);
console.log(`  rightMoment (C.leftMoment) = ${fmt(rightMoment_mainSpan)}`);
console.log(`  rightReaction = (${loadMoments_mainSpan} - ${fmt(leftMoment_mainSpan)} - ${fmt(rightMoment_mainSpan)}) / ${L_mainSpan} = ${fmt(rightReaction_manual)}`);
console.log(`  leftReaction = 60 - ${fmt(rightReaction_manual)} = ${fmt(leftReaction_manual)}`);

// Correct expected values:
// The moment at B from the overhang is -30 kNm (hogging, clockwise).
// For the main span, taking moments about C (from B):
//   Rb_mainSpan * 6 = 60*3 - (-30) = 180 + 30 = 210... NO
//   Actually, the end moments affect the moment equation:
//   Taking moment about the RIGHT end (C) for the main span:
//   Rb_ms * L + M_left + M_right = sum(load * distance_from_right)
//   
//   Let me use the standard beam convention:
//   Sum of moments about C = 0:
//   Rb*6 - 60*(6-3) + M_B - M_C = 0
//   where M_B is the moment at B (from all sources) and M_C is at C
//   
//   For a simply supported span:
//   Rb*6 = 60*3 - M_B + M_C
//         = 180 - M_B + 0  (since C is roller/pinned, M_C = 0)
//   
//   M_B from overhang = -30 (the moment from overhang transferred to main span)
//   But what does "leftMoment" and "rightMoment" at B mean here?
//   
//   B.leftMoment = moment from overhang side (clk direction) = -30
//   B.rightMoment = moment from main span side (antiClk direction) = 30 (equal and opposite at joint)
//   
//   So for main span: the end moment at B = B.rightMoment = 30
//   rightReaction = (180 - 30 - 0) / 6 = 150/6 = 25
//   leftReaction = 60 - 25 = 35
//   
//   Total at B: overhang contributes 20, mainSpan contributes 35 → Rb = 55? No wait:
//   leftReaction of mainSpan = 35 (B is the left end of main span)
//   
//   Total at B = 20 (from overhang rightReaction) + 35 (from mainSpan leftReaction) = 55?
//   But we expected 45!

console.log("\n\nLet me re-derive the correct answer by pure statics:");
console.log("  Global equilibrium: Rb + Rc = 80");
console.log("  Sum moments about C (at x=9):");
console.log("    Rb*(9-3) - 20*(9-1.5) - 10*6*(9-6) = 0");
console.log("    Rb*6 = 20*7.5 + 60*3 = 150 + 180 = 330");
console.log("    Rb = 330/6 = 55");
console.log("    Rc = 80 - 55 = 25");
console.log("  So actually the SOLVER IS CORRECT! My hand calc was wrong.");
console.log("  Rb=55, Rc=25 is the correct answer.");
