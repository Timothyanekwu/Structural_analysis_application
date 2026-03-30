/**
 * Quick verification: Does fixing momtAbtNode sign fix indeterminate cases
 * without breaking determinate ones?
 * 
 * We'll patch momtAbtNode inline and test both cases.
 */
import { Beam } from "../elements/member";
import { PointLoad, UDL } from "../elements/load";
import { Node } from "../elements/node";
import { FixedSupport, PinnedSupport, RollerSupport } from "../elements/support";
import { FixedEndMoments } from "../logic/FEMs";
import { Equation } from "../logic/simultaneousEqn";

function fmt(n: number) { return n.toFixed(4); }

// Patched momtAbtNode with the fix
function momtAbtNodeFixed(member: Beam, node: Node) {
  let result = 0;
  for (const load of member.getEquivalentPointLoads()) {
    if (member.startNode === node) {
      const distance = load.position;  // FIX: was 0 - load.position
      const moment = load.magnitude * distance;
      result += moment;
    } else if (member.endNode === node) {
      const distance = member.length - load.position;
      const moment = load.magnitude * distance;
      result += moment;
    }
  }
  return result * -1;
}

// Original momtAbtNode
function momtAbtNodeOriginal(member: Beam, node: Node) {
  let result = 0;
  for (const load of member.getEquivalentPointLoads()) {
    if (member.startNode === node) {
      const distance = 0 - load.position;
      const moment = load.magnitude * distance;
      result += moment;
    } else if (member.endNode === node) {
      const distance = member.length - load.position;
      const moment = load.magnitude * distance;
      result += moment;
    }
  }
  return result * -1;
}

console.log("=== Sign comparison ===");
console.log("Test 1: Left overhang A(free,0)---B(sup,2), 10kN at 1m");
{
  const nA = new Node("A", 0, 0);
  const sB = new PinnedSupport(2, 0);
  const nB = new Node("B", 2, 0, sB);
  const ovh = new Beam(nA, nB, 0, 0, null, 1, 1);
  ovh.addLoad(new PointLoad(1, 10));
  
  // B is endNode of overhang
  console.log(`  endNode B: original=${momtAbtNodeOriginal(ovh, nB)}, fixed=${momtAbtNodeFixed(ovh, nB)}`);
  console.log("  Physical: 10kN at 1m left of B → clockwise → should be -10");
}

console.log("\nTest 2: Right overhang B(sup,6)---C(free,8), 10kN at 1m from B");
{
  const sB = new RollerSupport(6, 0);
  const nB = new Node("B", 6, 0, sB);
  const nC = new Node("C", 8, 0);
  const ovh = new Beam(nB, nC, 0, 0, null, 1, 1);
  ovh.addLoad(new PointLoad(1, 10));
  
  // B is startNode of overhang
  console.log(`  startNode B: original=${momtAbtNodeOriginal(ovh, nB)}, fixed=${momtAbtNodeFixed(ovh, nB)}`);
  console.log("  Physical: 10kN at 1m right of B → clockwise → should be -10");
}

console.log("\nTest 3: Right overhang B(sup,9)---F(free,12), 20kN at 2m from B");
{
  const sB = new RollerSupport(9, 0);
  const nB = new Node("B", 9, 0, sB);
  const nF = new Node("F", 12, 0);
  const ovh = new Beam(nB, nF, 0, 0, null, 1, 1);
  ovh.addLoad(new PointLoad(2, 20));
  
  console.log(`  startNode B: original=${momtAbtNodeOriginal(ovh, nB)}, fixed=${momtAbtNodeFixed(ovh, nB)}`);
  console.log("  Physical: 20kN at 2m right of B → clockwise → should be -40");
}

// Now test: with the fixed momtAbtNode, do determinate cases still work?
// For Test 2 (right overhang, determinate):
// A(pinned,0) === B(roller,6) --- C(free,8), 10kN at 1m from B
console.log("\n\n=== Determinate case with FIXED momtAbtNode ===");
console.log("A(pinned,0) === B(roller,6) --- C(free,8), 10kN at 1m from B");
{
  const sA = new PinnedSupport(0, 0);
  const sB = new RollerSupport(6, 0, sA);
  const nA = new Node("A", 0, 0, sA);
  const nB = new Node("B", 6, 0, sB);
  const nC = new Node("C", 8, 0);
  const mainSpan = new Beam(nA, nB, 0, 0, null, 1, 1);
  const ovh = new Beam(nB, nC, 0, 0, null, 1, 1);
  ovh.addLoad(new PointLoad(1, 10));
  
  // With FIXED momtAbtNode: overhang moment at B = -10 (correct clockwise)
  // At B: clk has mainSpan M_BA. antiClk has overhang = -10.
  // isTrmnlNode(A) = true (1 beam member), A is pinned → modified SDE for main span from B's endNode perspective
  // clk[MOMENT_BA] = {c: 0, EItetaB: 3/6 = 0.5}
  // Equation: 0.5*θ_B + (-10) = 0 → θ_B = 20
  // M_BA (modified SDE) = 0.5 * 20 = 10 (anticlockwise at B on beam)
  
  // For main span reactions:
  // A.rightMoment = 0 (terminal pinned)
  // B.leftMoment = M_BA = 10
  // memberEndReactions: rightReaction = (0 - 0 - 10)/6 = -5/3
  // leftReaction = 0 - (-5/3) = 5/3
  // 
  // Total Ra = 5/3, Total Rb = -5/3 + 10 = 25/3
  // Expected: Ra = -5/3, Rb = 35/3
  // WRONG! Ra is off by 10/3.
  
  console.log("  With fixed momtAbtNode:");
  console.log("  θ_B = 20, M_BA = 10");
  console.log("  Main span: leftR=5/3, rightR=-5/3");
  console.log("  Overhang: leftR=10 (all to B)");
  console.log(`  Total Ra = ${fmt(5/3)}, Rb = ${fmt(-5/3 + 10)}`);
  console.log(`  Expected: Ra = ${fmt(-5/3)}, Rb = ${fmt(35/3)}`);
  console.log("  FAIL: off by 10/3 = overhang_moment/L_mainspan");
  
  // The problem: The overhang moment at B modifies the main span's end moments,
  // which changes the main span's reaction distribution. But the main span
  // reactions should NOT be affected by the overhang moment -- the overhang moment
  // at B only tells us about moment equilibrium, not about load distribution.
  //
  // In a DETERMINATE beam (pinned-roller), the moments at both ends are ZERO regardless.
  // The slope-deflection should give M_BA = 0 for a simple span with pinned ends.
  // But because B is NOT terminal (2 members), the code uses the full SDE, which
  // includes θ_B. The overhang moment gives θ_B ≠ 0, leading to M_BA ≠ 0.
  //
  // THIS IS ACTUALLY CORRECT! In a continuous beam formulation, the moment at an 
  // interior support (B) is NOT zero when there's an overhang with moment.
  // But for a simply-supported span, the moment at a pinned/roller end IS zero...
  // unless there's an applied moment from an overhang.
  //
  // The key insight: When both ends of a span are supported, the slope-deflection
  // naturally distributes the effect of an overhang moment. The reactions include
  // both the vertical load effect AND the moment effect.
  //
  // So with CORRECT signs:
  // M_BA = +10 (due to overhang moment causing rotation at B)
  // This moment at B creates reactions: Ra_ms = +5/3 upward, Rb_ms = -5/3 downward
  // Plus the overhang direct load: Rb_ovh = +10
  // Total: Ra = 5/3, Rb = 25/3. Sum = 5/3 + 25/3 = 30/3 = 10. ✓ equilibrium
  //
  // But global statics says Ra = -5/3! 
  // Global moment about B: Ra*6 = 10*(8-1) - 10*6 = 70 - 60 = 10? No...
  // Global moment about B: Ra*6 = 10*7 → Ra*6 = 10*(6+1) 
  // Wait: 10kN at x=7 (global). Moment about B at x=6: 
  //   Ra*6 = 10*(7-0)?? No, the load is at x=7 and the supports are at 0 and 6.
  //   Taking moment about B: Ra*6 - 10*(7-6) = 0... no, load is downward.
  //   Ra*6 = 10*(7-6)*(-1)? Let me use the clear version:
  //   ΣM_B = 0: Ra*6 - 10*(7-6) = 0 → Ra*6 = 10*1 = 10 → Ra = 10/6 = 5/3
  //   WAIT WHAT?! Ra = 5/3??
  //
  //   ΣM_B = 0 (ACW positive):
  //   +Ra * 6  (upward force 6m to the left → ACW about B)
  //   -10 * 1  (10kN downward, 1m to the right of B → CW about B)
  //   = 0
  //   Ra = 10/6 = 5/3
  //   Rb = 10 - 5/3 = 25/3
  //
  //   But earlier tests showed Ra = -5/3. Let me check...
  //   The load is at position 1 on the overhang (B-C). Since B is at x=6 and C at x=8,
  //   the load is at x=7 globally.
  //   ΣM_A = 0: Rb*6 = 10*7 → Rb = 70/6 = 35/3
  //   Ra = 10 - 35/3 = -25/3 ... NO: (30 - 35)/3 = -5/3

  console.log("\n  WAIT - let me recheck global statics:");
  console.log("  Load: 10kN at x=7 (global)")
  console.log("  ΣM_A=0: Rb*6 = 10*7 = 70 → Rb = 70/6 = 35/3");
  console.log("  Ra = 10 - 35/3 = -5/3");
  console.log("");
  console.log("  ΣM_B=0: Ra*6 = 10*(7-6)... NO!");
  console.log("  ΣM_B=0: Ra*6 + 10*(6-7) = 0");
  console.log("  Ra*6 = 10*1 = 10... NO, the load is to the RIGHT of B!");
  console.log("  Load at x=7, B at x=6. Moment of load about B = -10*(7-6) = -10 (CW)");
  console.log("  Moment of Ra about B = +Ra*(0-6) = -6*Ra (CW if Ra>0)");
  console.log("  Sum = -6*Ra - 10 = 0 → Ra = -10/6 = -5/3");
  console.log("  So Ra = -5/3 and Rb = 10 - (-5/3) = 35/3. CONFIRMED.");
  console.log("");
  console.log("  So the FIXED momtAbtNode gives Ra=5/3 but correct is -5/3.");
  console.log("  The ORIGINAL code gives Ra=-5/3 (correct!).");
  console.log("  This means the original sign convention in momtAbtNode is");
  console.log("  actually designed to work with the reaction formula.");
  console.log("  The bug must be elsewhere for indeterminate cases.");
}
