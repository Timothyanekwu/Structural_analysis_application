/**
 * Final root cause analysis: trace through the INDETERMINATE case step by step
 * and compute what the CORRECT answer should be with the code's own conventions.
 */
import { BeamSolver } from "../beamSolver/beamSolver";
import { Beam } from "../elements/member";
import { PointLoad, UDL } from "../elements/load";
import { Node } from "../elements/node";
import { FixedSupport, RollerSupport } from "../elements/support";

function fmt(n: number) { return n.toFixed(4); }

// INDETERMINATE: E(free,0) --- A(fixed,3) === B(roller,9) --- F(free,12)
// Left overhang: UDL 10kN/m on E-A
// Right overhang: 20kN at 2m from B on B-F
// Main span A-B: no loads, L=6

// Step 1: What's the correct answer by global statics + compatibility?
// θ_A = 0 (fixed), θ_B = unknown
// 
// Using the CODE's internal convention where momtAbtNode for startNode
// returns POSITIVE for a load to the RIGHT:
//   momtAbtNode(rightOvh, B) = +40  (code convention)
//   momtAbtNode(leftOvh, A) = -45   (code convention, endNode → correct)
//
// Equilibrium at B (code convention): M_BA_code + 40 = 0 → M_BA_code = -40
// With full SDE: M_BA_code = (2EI/L)(2θ_B) = (2/3)θ_B = -40 → θ_B = -60
// M_AB_code = (2EI/L)(θ_B) = (1/3)(-60) = -20
//
// Now what should the correct answer be?
// The real physical equilibrium at B is:
//   M_BA_real + M_overhang_B_real = 0
//   M_overhang_B_real = -40 (clockwise, ACW-positive convention)
//   ∴ M_BA_real = +40
//
// With SDE: (2/3)θ_B_real = 40 → θ_B_real = 60
// M_AB_real = (1/3)(60) = 20
//
// So the code's θ_B and M values have the WRONG SIGN.
//
// BUT the code's reaction formula compensates:
// memberEndReactions for main span (both supported):
//   leftMoment = A.rightMoment = M_AB
//   rightMoment = B.leftMoment = M_BA
//   rightReaction = (loads - leftMoment - rightMoment) / L
//
// Code: rightR = (0 - (-20) - (-40))/6 = 60/6 = 10 (R_B_mainspan = 10)↑
// Real: rightR = (0 - 20 - 40)/6 = -60/6 = -10 (R_B_mainspan = -10)↓
//
// For the determinate case, overhang.left = totalLoads = same either way.
// Total at B: Code gives -10+20=10, Real gives -10+20=10... wait they're same?!
// 
// NO: Code gives R_B_main=10, Real gives R_B_main=-10.
// Code: Total Rb = 10 + 20 = 30
// Real: Total Rb = -10 + 20 = 10
//
// Let's check which is correct by global statics:
// ΣFy: Ra + Rb = 50 (30 from UDL + 20 from PL)
// ΣM about A (at x=3, ACW positive):
//   Ma + Rb*(9-3) - 30*(3-1.5) - 20*(11-3) = 0
//   Ma + 6*Rb - 45 - 160 = 0
//   Ma + 6*Rb = 205
//
// With code values: Ma=-65, Rb=30:
//   -65 + 180 = 115 ≠ 205. ❌ WRONG
//
// With real values: Ma=?, Rb=10:
//   Ma + 60 = 205 → Ma = 145?? That seems large...
//   
// Let me compute Ma_real:
//   Ma = M_AB_real + M_ovh_A = 20 + (-45) = -25
//   Check: -25 + 60 = 35 ≠ 205. ❌ Also wrong!
//
// I must have an error in the moment equation. Let me redo carefully.
// 
// Taking moments about B (at x=9), ACW positive:
// Forces:
//   Ra ↑ at x=3: moment = Ra*(3-9) = -6*Ra
//   30kN ↓ at x=1.5: moment = -(-30)*(1.5-9) = 30*(9-1.5) = 225
//     WAIT: 30 downward at x=1.5. Moment about B = -30*(1.5-9) = -30*(-7.5) = 225 ACW ✓
//   20kN ↓ at x=11: moment = -20*(11-9) = -40 CW
//   Ma at A: just adds directly = Ma (ACW positive)
//
// Sum: -6*Ra + 225 - 40 + Ma = 0
// Also: Ra + Rb = 50, Ra = 50 - Rb
//
// Verified that moment balance should hold. Ma = 6*Ra - 185.
console.log("=== What SHOULD the correct answer be? ===");
console.log("Global statics + slope-deflection:\n");

// Using standard ACW-positive everywhere.
// θ_A = 0, θ_B = unknown.
// Main span SDE (no loads, no settlement, L=6, EI=1):
//   M_AB = (2/6)(2*0 + θ_B) = θ_B/3
//   M_BA = (2/6)(2*θ_B + 0) = 2θ_B/3
//
// Overhang moments (pure statics):
//   Left ovh (E-A): 30kN at 1.5m from A → clockwise at A → M_ovhA = -45
//   Right ovh (B-F): 20kN at 2m from B → clockwise at B → M_ovhB = -40
//
// Equilibrium at B (sum of moments on JOINT = 0):
//   Moment on joint from main span = M_BA (M_BA on beam = M_BA on joint, same direction)
//   Moment on joint from overhang = M_ovhB = -40
//   M_BA + M_ovhB = 0
//   (2/3)θ_B + (-40) = 0
//   θ_B = 60
//
// End moments:
//   M_AB = 60/3 = 20 (ACW at A - sagging tendency)
//   M_BA = 2*60/3 = 40 (ACW at B - hogging tendency)
//
// Main span reactions (FBD, no loads):
//   ΣM_A = 0: Rb_ms*6 + M_AB + M_BA = 0
//                        Rb_ms*6 + 20 + 40 = 0
//                        Rb_ms = -10
//   Ra_ms = 0 - (-10) = 10
//   CHECK: ΣM_B = 0: Ra_ms*(-6) + M_AB + M_BA = 10*(-6) + 20 + 40 = 0 ✓
//   Wait: -60 + 60 = 0 ✓

console.log("Main span FBD (ACW convention):");
console.log("  M_AB=20, M_BA=40, no loads");
console.log("  Rb_ms = -(20+40)/6 = -10");
console.log("  Ra_ms = 10");

// Overhang reactions:
//   Left ovh: all load to A → R_ovhA = 30
//   Right ovh: all load to B → R_ovhB = 20
console.log("\nOverhang reactions:");
console.log("  R_ovhA = 30, R_ovhB = 20");

// Total:
const Ra = 10 + 30;  // mainSpan.left + leftOvh.right
const Rb = -10 + 20; // mainSpan.right + rightOvh.left
const Ma = -45 + 20;  // leftOvh moment + M_AB
console.log(`\nTotal: Ra=${Ra}, Rb=${Rb}, Ma=${Ma}`);
console.log(`Sum = ${Ra + Rb} (should be 50)`);

// Global ΣM about B:
const check = -6*Ra + 30*(9-1.5) - 20*(11-9) + Ma;
console.log(`ΣM_B = -6*${Ra} + 225 - 40 + ${Ma} = ${check} (should be 0)`);

// Hmm, -6*40 + 225 - 40 + (-25) = -240 + 225 - 40 - 25 = -80 ≠ 0
// Still wrong! So my "correct" answer also doesn't satisfy global equilibrium.
// I must be making an error in the FBD of the main span.

console.log("\n\n=== Let me redo the main span FBD ===");
console.log("Beam A-B, length 6.");
console.log("At A: moment M_AB acts on beam, reaction Ra_ms acts upward");
console.log("At B: moment M_BA acts on beam, reaction Rb_ms acts upward");
console.log("No other loads.");
console.log("");
console.log("ΣM about A (ACW+):");
console.log("  M_AB + Rb_ms*6 + M_BA = 0");
console.log("  But wait - does M_BA at B contribute ACW or CW about A?");
console.log("  A moment is a free vector. M_BA = +40 ACW. About any point, it's +40 ACW.");
console.log("  M_AB = +20 ACW about A.");
console.log("  Rb_ms upward at distance +6: creates ACW about A → +Rb_ms*6");
console.log("  Sum: 20 + 6*Rb_ms + 40 = 0 → Rb_ms = -60/6 = -10 ✓");
console.log("");
console.log("ΣFy: Ra_ms + Rb_ms = 0 → Ra_ms = 10 ✓");
console.log("");

// Now for the full structure moment check:
// At A, the FIXED SUPPORT provides:
//   Vertical reaction Ra_total (upward)
//   Moment reaction Ma (ACW+)
//
// The fixed support moment = sum of member end moments at A
// Members at A: leftOvh (A is endNode) and mainSpan (A is startNode)
// leftOvh end moment at A = M_AE = momtAbtNode result = -45 (clockwise = static moment of overhang loads)
// mainSpan end moment at A = M_AB = 20 (from SDE)
// 
// But WHICH of these is the support moment reaction?
// Ma = M_AE + M_AB? Or is it something else?
//
// The support moment reaction is the EXTERNAL moment that the support applies.
// At joint A, the equilibrium is:
//   Ma_support + M_AE + M_AB = 0
//   Ma_support = -(M_AE + M_AB) = -(-45 + 20) = 25
// 
// WAIT! The support moment is NOT M_AE + M_AB. It's the NEGATIVE of that!
// The support applies a reaction to BALANCE the member moments.

console.log("=== Fixed support moment ===");
console.log("Joint A equilibrium: Ma_support + M_AE + M_AB = 0");
console.log(`Ma_support = -(${-45} + ${20}) = ${-(-45 + 20)} = 25`);

const Ma_correct = 25;
console.log(`\nCorrected: Ra=${Ra}, Rb=${Rb}, Ma=${Ma_correct}`);
const check2 = -6*Ra + 30*(9-1.5) - 20*(11-9) + Ma_correct;
console.log(`ΣM_B = -6*${Ra} + 225 - 40 + ${Ma_correct} = ${check2}`);
// = -240 + 225 - 40 + 25 = -30 ≠ 0. Still wrong!

// There's ANOTHER error. Let me redo the ENTIRE problem from scratch.
console.log("\n\n=== COMPLETE REDO FROM SCRATCH ===");
console.log("Structure: E(free,0)---A(fixed,3)===B(roller,9)---F(free,12)");
console.log("Loads: 30kN↓ at x=1.5, 20kN↓ at x=11\n");

// Global equilibrium:
// ΣFy: Ra + Rb = 50
// ΣM_A (at x=3): Ma + Rb*6 - 30*(3-1.5) - 20*(11-3) = 0
//                 Ma + 6Rb - 45 - 160 = 0
//                 Ma + 6Rb = 205  ... (i)
//
// We need one more equation from compatibility (slope-deflection).
// The compatibility condition: θ_A = 0 (fixed support).
//
// The slope-deflection for main span (no loads):
//   M_AB = (2EI/L)(2θ_A + θ_B) = (2/6)(θ_B) = θ_B/3
//   M_BA = (2EI/L)(2θ_B + θ_A) = (2/6)(2θ_B) = 2θ_B/3
//
// At B (roller, no external moment; but overhang moment acts):
//   M_BA + M_ovhB = 0, where M_ovhB = moment from overhang at B
//
// The overhang moment at B: 20kN at 2m from B creates -40 kNm at B (clockwise, ACW negative).
// BUT HOLD ON - this overhang moment is part of the INTERNAL moment equilibrium at B.
// It's the moment that the overhang MEMBER exerts on joint B.
//
// For the overhang B-F (cantilever from B):
// The fixed-end moment at B of the cantilever = moment of loads about B
// = 20*2 = 40 kNm (this is the moment the loads create at the fixed=support end)
// Convention: the support must resist with an equal and opposite moment.
// If the load sags the cantilever (clockwise about B looking right), the support
// resistance moment is anticlockwise = +40 ACW.
//
// But wait - in the SDE formulation, the "moment at end i of member ij" (M_ij)
// is the moment that the member exerts on the joint.
// For a cantilever B->F with a downward load:
//   The member (beam B-F) exerts a moment on joint B.
//   The load pulls F down, which rotates B clockwise.
//   The beam resists this, exerting a clockwise resistance on joint B.
//   No wait - the beam TRANSMITS the load effect. The beam exerts a clockwise
//   moment on joint B because the load creates a clockwise tendency.
//
// Actually: for a fixed-free cantilever (fixed at B, free at F):
//   At the fixed end B, the internal moment is:
//   M = +40 (ACW on the beam) if we use ACW-positive on the beam.
//   Wait no - a downward load sags the beam, which means the top is in tension,
//   which is a HOGGING moment at B, which is CLOCKWISE on the beam = -40 ACW.
//   
//   Hmm, for a cantilever with a point load at the free end:
//   M(0) = -P*L (hogging). So M_BF = -20*2 = -40 (CW on beam = hogging).
//   The beam exerts this on the joint: -40 ACW = clockwise on joint B.

console.log("Overhang moment at B:");
console.log("  Cantilever B-F with 20kN at 2m: M_BF = -40 (CW, hogging)");
console.log("  Joint B equilibrium: M_BA + M_BF = 0");
console.log("  M_BA + (-40) = 0 → M_BA = 40 (ACW)");
console.log("  2θ_B/3 = 40 → θ_B = 60");
console.log("  M_AB = θ_B/3 = 20 (ACW)");
console.log("");

// Now, AT JOINT A:
// Joint A has: main span A-B and left overhang E-A.
// The member moments at A:
//   From main span: M_AB = 20 (ACW on beam/joint)  
//   From left overhang: cantilever from A to E. 
//     Moment at A = moment of loads about A. 
//     30kN at 1.5m from A. M_AE = -30*1.5 = -45 (CW = hogging).
//
// Joint equilibrium at A: M_AB + M_AE + Ma_support = 0
// The fixed support reaction moment: Ma_support = -(M_AB + M_AE) = -(20 + (-45)) = 25
//
// Main span FBD: Ra_ms, Rb_ms, M_AB=20, M_BA=40, no loads.
// ΣM_B: Ra_ms*(-6) + 20 + 40 = 0 → Ra_ms = 10
// Rb_ms = -10
//
// Total reactions:
// Ra = Ra_ms + Rovh_A = 10 + 30 = 40
// Rb = Rb_ms + Rovh_B = -10 + 20 = 10
// Ma = 25
//
// CHECK: ΣFy: 40 + 10 = 50 ✓
// CHECK: ΣM_A: Ma + Rb*6 - 30*(1.5) - 20*(8) = 25 + 60 - 45 - 160 = -120 ≠ 0. ❌

console.log("With Ma=25, Ra=40, Rb=10:");
console.log(`  ΣM_A: ${25} + ${10*6} - ${30*1.5} - ${20*8} = ${25 + 60 - 45 - 160}`);
console.log("  ≠ 0!!! Something is still wrong.\n");

// Let me recompute the moment balance about A more carefully.
// Moment about x=3 (where A is):
// Each force/moment contributes:
//   Ma = 25 ACW → +25
//   Ra = 40↑ at x=3 → moment about A = 0 (it's at A)
//   Rb = 10↑ at x=9 → moment = +10*(9-3) = +60 ACW
//   30kN↓ at x=1.5 → moment = -30*(1.5-3) = -30*(-1.5) = +45 ACW
//   20kN↓ at x=11 → moment = -20*(11-3) = -20*8 = -160 CW
//   
//   Sum = 25 + 0 + 60 + 45 - 160 = -30 ≠ 0

console.log("Detailed moment about A(x=3):");
console.log("  Ma: +25");
console.log("  Ra(40↑ at x=3): 0 (at the point)");
console.log("  Rb(10↑ at x=9): +10*(9-3) = +60");
console.log("  30kN↓ at x=1.5: -30*(1.5-3) = +45");
console.log("  20kN↓ at x=11: -20*(11-3) = -160");
console.log("  Sum = 25 + 60 + 45 - 160 = -30 ≠ 0");
console.log("");
console.log("So Ma must be 30 for equilibrium, not 25. What went wrong?");
console.log("");
console.log("The issue: I forgot the moment balance of the MAIN SPAN is coupled!");
console.log("The fixed support moment Ma is NOT just -(M_AB + M_AE).");
console.log("Ma is the EXTERNAL moment reaction, and it must satisfy GLOBAL equilibrium.");
console.log("");

// Let's solve properly.
// Global equilibrium:
//   ΣFy: Ra + Rb = 50  ... (1)
//   ΣM about any point, say A:
//     Ma + Rb*6 + 30*1.5 - 20*8 = 0  (loads to left of A contribute + due to CW... NO)
//
// Let me be very careful with signs.
// ACW positive. Take moments about A (at x=3).
// Each contribution:
//   Ma: moment reaction, ACW positive → +Ma
//   Rb: upward at x=9. Moment = Rb*(9-3) = 6Rb (upward force to the RIGHT of A → ACW → positive)
//   30kN↓ at x=1.5: Moment = -30*(1.5-3) = -30*(-1.5) = +45
//     (downward force to the LEFT of A → ACW about A → positive)
//   20kN↓ at x=11: Moment = -20*(11-3) = -160
//     (downward force to the RIGHT → CW → negative)
//
//   Sum = Ma + 6Rb + 45 - 160 = 0
//   Ma + 6Rb = 115  ... (2)
//
// From slope-deflection, we need a 3rd equation.
// θ_B gives us M_BA and M_AB.
// Ma is related to the internal moments by:
//   Ma = -M_AB - M_AE (joint equilibrium at A)
// Wait, this IS a valid equation due to the joint equilibrium at A.
// 
// But let me check: does joint A equilibrium give Ma?
// At joint A, the members exert moments. The support provides Ma.
// Member moments at A:
//   M_AB (from main span) = moment on joint from main span
//   M_AE (from left overhang) = moment on joint from overhang = -45
// Support reaction: Ma
//
// Equilibrium: Ma + M_AB + M_AE = 0
//   Ma = -(M_AB + M_AE) = -(M_AB - 45)
//   Ma = 45 - M_AB

// From (2): Ma + 6Rb = 115
//   (45 - M_AB) + 6Rb = 115
//   6Rb = 70 + M_AB  ... (3)

// From main span FBD: Rb_ms = -(M_AB + M_BA)/6
// And M_AB = θ_B/3, M_BA = 2θ_B/3
// So M_AB + M_BA = θ_B/3 + 2θ_B/3 = θ_B
// Rb_ms = -θ_B/6
// Total Rb = Rb_ms + Rovh_B = -θ_B/6 + 20

// From joint B equilibrium: M_BA - 40 = 0 → 2θ_B/3 = 40 → θ_B = 60
// So Rb_ms = -60/6 = -10, Rb = -10 + 20 = 10

// From (3): 6*10 = 70 + M_AB → M_AB = -10
// But we got M_AB = θ_B/3 = 60/3 = 20. CONTRADICTION!

console.log("=== CONTRADICTION CHECK ===");
console.log("From global statics: Ma + 6Rb = 115, Ma = 45 - M_AB");
console.log("  → 6Rb = 70 + M_AB");
console.log("From SDE: θ_B = 60, M_AB = 20, Rb = -10 + 20 = 10");
console.log("  → 6*10 = 60 but 70 + M_AB = 70 + 20 = 90");
console.log("  60 ≠ 90. CONTRADICTION!");
console.log("");
console.log("This means the slope-deflection solution θ_B = 60 is WRONG for this system!");
console.log("The issue: The equilibrium equation at B only considers M_BA + M_ovhB = 0,");
console.log("but this ignores the fact that the overhang reaction at B also creates a");
console.log("moment offset that affects the global equilibrium.");
console.log("");
console.log("Actually, the equilibrium at joint B IS correct for moment at B.");
console.log("The issue must be in how Ma is computed.");
console.log("");
console.log("Let me solve the problem completely using the proper approach:");
console.log("3 equations: (1) Ra+Rb=50, (2) Ma+6Rb=115, plus SDE for θ_B");
console.log("");

// Actually, the slope-deflection method itself should give exactly 3 pieces of info:
// θ_B, M_AB, M_BA, and then Ma follows from joint equilibrium.
// Let me solve without assuming and check.

// Fixed support at A: θ_A = 0
// Roller at B: External moment = 0
// Joint B equil: M_BA + M_ovhB = 0
//   (2/3)θ_B + (-40) = 0 → θ_B = 60
//   M_AB = 20, M_BA = 40

// Now Ma from joint A equilibrium:
//   Ma + M_AB + M_AE = 0
//   Ma = -(20 + (-45)) = -(20 - 45) = 25
// But we showed this gives ΣM_B ≠ 0.

// Unless my global moment calculation is wrong. Let me check VERY carefully:
// ΣM about B (at x=9), all forces:
//   Ma = 25 ACW at x=3: moment about B = +25 (free vector - doesn't matter where)
//   Ra↑ at x=3: moment = Ra*(3-9) = -6*Ra (upward at left → CW about B → negative)
//   Rb↑ at x=9: moment = 0
//   30kN↓ at x=1.5: moment = (-30)*(1.5-9) = -30*(-7.5) = +225 (downward at left → ACW)
//   20kN↓ at x=11: moment = (-20)*(11-9) = -40 (downward at right → CW)

console.log("ΣM about B with Ra=40, Ma=25:");
console.log(`  25 + (-6*40) + 0 + 225 + (-40) = ${25 - 240 + 225 - 40} = ${25 - 240 + 225 - 40}`);
// = 25 - 240 + 225 - 40 = -30

console.log("  = -30 ≠ 0. The solution is inconsistent.\n");

// The problem: with θ_B = 60, the main span reactions are Ra_ms=10, Rb_ms=-10.
// But the overhang reactions are: left=30 → A, right=20 → B.
// Ra = 40, Rb = 10, Ma = 25. But ΣM ≠ 0.
//
// This means the slope-deflection approach (as implemented) is MISSING something.
// What's missing? The moment balance for the MAIN SPAN is:
//   Ra_ms * 6 + M_AB + M_BA = 0 (no loads)
//   This gives Ra_ms = -(M_AB + M_BA)/6
// This IS correct for an isolated beam with end moments.
//
// But in the FULL structure, the main span is NOT isolated. 
// The MAIN SPAN also carries the shear from end moments caused by the overhangs.
// The slope-deflection method handles this through the equilibrium equations at joints.
//
// The issue: In the standard slope-deflection method for beams, we write equilibrium
// at each non-fixed joint and solve for θ values. Then we back-compute end moments
// and reactions.
//
// For the main span reactions:
//   ΣM about A for main span FBD:
//   Rb_ms*L + M_AB + M_BA = Σ(loads on main span * distance)
// This is correct IF M_AB and M_BA are ONLY from the slope-deflection of the main span.
// But in our case, M_AB and M_BA from the SDE already INCLUDE the effect of θ_B which
// was determined by the overhang moment at B. So the main span reactions DO account
// for the overhang effect. But somehow global equilibrium still fails.
//
// I think the issue is that the Ma calculation is wrong.
// Ma should be: the EXTERNAL moment reaction at the fixed support.
// From the GLOBAL FBD:
//   Ma = 115 - 6*Rb = 115 - 60 = 55
// 
// From joint equilibrium:
//   Ma = -(M_AB + M_AE) = -(20 - 45) = 25
//
// These don't match (55 ≠ 25), which means the joint equilibrium
// equation Ma = -(M_AB + M_AE) is WRONG!
//
// Why? Because the joint equilibrium should include ALL moments at the joint,
// including the moment from the VERTICAL reactions of members.
// The member shear forces also contribute a moment at the joint!
// 
// Actually wait, no. Joint equilibrium for MOMENTS only involves the member
// end MOMENTS, not the shears. Shears contribute to force equilibrium, not moment.
//
// Unless... the Ma in the code's beamSolver is computed differently from what I expect.

console.log("=== Code's Ma computation (beamSolver.ts line 208-211) ===");
console.log("  if (support.type === 'fixed'):");
console.log("    momentReaction = support.leftMoment + support.rightMoment + node.momentLoad");
console.log("  ");
console.log("  support.leftMoment and support.rightMoment are SET in updatedGetFinalMoments()");
console.log("  from the clk and antiClk sums at the node.");
console.log("  ");
console.log("  For node A:");
console.log("    support.leftMoment = sum of clk = M_AE = -45");
console.log("    support.rightMoment = sum of antiClk = M_AB = -20 (code's convention)");
console.log("    Ma = -45 + (-20) = -65 (code's answer)");
console.log("  ");
console.log("  CORRECT Ma from global statics: Ma = 115 - 6*10 = 55");
console.log("  ");
console.log("  BUT WAIT: the code's sign convention is DIFFERENT.");
console.log("  In the code, support.leftMoment + support.rightMoment = net moment from MEMBERS.");
console.log("  The support reaction is this SUM, not the negative.");
console.log("  So the code computes momentReaction as (leftMoment + rightMoment).");
console.log("  ");
console.log("  The question is: should it be SUM or NEGATIVE of sum?");
console.log("  Code says: momentReaction = leftMoment + rightMoment");
console.log("  Physics says: support reacts with OPPOSITE → momentReaction = -(leftMoment + rightMoment)");

// Run the actual solver and get results
const solver = new BeamSolver([
  (() => {
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
    return leftOvh;
  })()
]);
// Can't easily extract — let me just compute what correct answer is
console.log("\n\n=== CORRECT ANSWER BY SIMULTANEOUS EQUATIONS ===");
// Ra + Rb = 50           ... (1)
// Ma + 6Rb + 45 - 160 = 0  → Ma = 115 - 6Rb   ... (2)
// θ_B = 60 from SDE
// Rb = Rb_ms + 20 = -(M_AB+M_BA)/6 + 20 = -θ_B/6 + 20 = -10 + 20 = 10
// Ra = 40
// Ma = 115 - 60 = 55

console.log("Ra = 40, Rb = 10, Ma = 55");
console.log("Check ΣM_B: 55 -6*40 + 225 - 40 = 55-240+225-40 = 0 ✓");
console.log("");
console.log("So the CORRECT Ma = 55, but code gives Ma = -65.");
console.log("Even my manual calc gave Ma = 25.");
console.log("");
console.log("The issue: Ma (support moment) ≠ sum of member end moments at A.");
console.log("Ma = -(M_AB + M_AE) only if the joint equilibrium only has moments.");
console.log("But the fixed support also resists the SHEAR from the overhang!");
console.log("Wait, that makes no sense for moment equilibrium...");
console.log("");

// Actually, I think the issue is simpler.
// Ma = -(M_AB + M_AE) IS correct for the MOMENT part of the support reaction.
// But the SIGN CONVENTION is the problem.
//
// In structural analysis, the fixed support moment is TYPICALLY defined as:
// Ma = anti-clockwise positive (ACW positive on the support)
//
// If the member moments at A sum to (20 + (-45)) = -25,
// the support must provide Ma = +25 to balance (ACW positive).
// But for global equilibrium, Ma = +25 doesn't work.
//
// Unless the member moments are BOTH wrong (which they are in the indeterminate case
// where the code gives θ_B = -60 instead of +60).
//
// With the CODE's values: M_AB = -20, M_AE = -45
// Ma_code = -20 + (-45) = -65 (code adds them, doesn't negate)
// If we negate: Ma = 65 ACW
//
// With CORRECT values: M_AB = 20, M_AE = -45
// Ma_correct = -(20 + (-45)) = 25 ACW
// But global equilibrium needs Ma = 55.
//
// SO THERE'S A DEEPER PROBLEM. Ma ≠ -(sum of member moments at A).
// Unless I'm computing global equilibrium wrong...

// Let me verify with a SIMPLE known case: propped cantilever, UDL.
// A(fixed) ---- B(roller), UDL w, length L.
// Standard answer: Ra = 5wL/8, Rb = 3wL/8, Ma = wL²/8 (ACW at A)
//
// From SDE: M_AB = wL²/8, M_BA = 0 (terminal roller)
// Support moment at A: Ma = M_AB = wL²/8 (the code's formula: leftMoment + rightMoment)
// leftMoment = 0 (nothing to the left), rightMoment = M_AB = wL²/8
// Ma = 0 + wL²/8 = wL²/8 ✓
//
// Check global ΣM_B: Ma + Ra*(0-L) + wL*(L/2) = 0
//   wL²/8 - 5wL²/8 + wL²/2 = wL²(1/8 - 5/8 + 4/8) = wL²(0) = 0 ✓

console.log("\nSimple case check: propped cantilever with UDL");
console.log("Ma = wL²/8. From code: leftMoment + rightMoment = 0 + wL²/8 = wL²/8 ✓");
console.log("Global equilibrium ✓");
console.log("");
console.log("So the code's formula Ma = leftMoment + rightMoment IS correct for the simple case.");
console.log("The problem with overhangs is that the WRONG θ_B leads to WRONG M_AB,");
console.log("which then gives wrong Ma.");
