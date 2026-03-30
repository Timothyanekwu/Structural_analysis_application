import { BeamSolver } from "../beamSolver/beamSolver";
import { Beam } from "../elements/member";
import { PointLoad, UDL, VDL } from "../elements/load";
import { Node } from "../elements/node";
import { FixedSupport, PinnedSupport, RollerSupport } from "../elements/support";

const EPS = 1e-6;

function assertClose(label: string, actual: number, expected: number, eps = EPS) {
  if (Math.abs(actual - expected) > eps) {
    throw new Error(
      `${label} mismatch. expected=${expected.toFixed(6)} actual=${actual.toFixed(6)}`,
    );
  }
}

function assertNearZero(label: string, actual: number, eps = EPS) {
  if (Math.abs(actual) > eps) {
    throw new Error(
      `${label} mismatch. expected≈0 actual=${actual.toFixed(6)}`,
    );
  }
}

function reactionY(
  reactions: Record<string, { yReaction: number; momentReaction: number }>,
  supportId: number,
) {
  return reactions[`SUPPORT${supportId}`]?.yReaction ?? 0;
}

function reactionM(
  reactions: Record<string, { yReaction: number; momentReaction: number }>,
  supportId: number,
) {
  return reactions[`SUPPORT${supportId}`]?.momentReaction ?? 0;
}

function runSimpleSpanPinnedRoller() {
  const sA = new PinnedSupport(0, 0);
  const sB = new RollerSupport(6, 0, sA);

  const nA = new Node("A", 0, 0, sA);
  const nB = new Node("B", 6, 0, sB);
  const span = new Beam(nA, nB, 0, 0, null, 1, 1);
  span.addLoad(new UDL(0, 6, 10));

  const solver = new BeamSolver([span]);
  const moments = solver.updatedGetFinalMoments();
  const reactions = solver.updatedGetSupportReactions();

  const mA = moments.find((m) => m.nodeId === "A");
  const mB = moments.find((m) => m.nodeId === "B");
  assertClose("simple span start moment", mA?.rightMoment ?? 0, 0);
  assertClose("simple span end moment", mB?.leftMoment ?? 0, 0);
  assertClose("simple span RA", reactionY(reactions, sA.id), 30);
  assertClose("simple span RB", reactionY(reactions, sB.id), 30);
}

function runCantileverFixedFree() {
  const sA = new FixedSupport(0, 0);

  const nA = new Node("A", 0, 0, sA);
  const nB = new Node("B", 5, 0);
  const span = new Beam(nA, nB, 0, 0, null, 1, 1);
  span.addLoad(new PointLoad(3, 12));

  const solver = new BeamSolver([span]);
  solver.updatedGetFinalMoments();
  const reactions = solver.updatedGetSupportReactions();

  assertClose("cantilever VA", reactionY(reactions, sA.id), 12);
  // Anti-clockwise support reaction moment is positive.
  assertClose("cantilever MA", reactionM(reactions, sA.id), 36);
}

function runOverhangFreePinnedRoller() {
  const sB = new PinnedSupport(2, 0);
  const sC = new RollerSupport(8, 0, sB);

  const nA = new Node("A", 0, 0);
  const nB = new Node("B", 2, 0, sB);
  const nC = new Node("C", 8, 0, sC);

  const overhang = new Beam(nA, nB, 0, 0, null, 1, 1);
  const mainSpan = new Beam(nB, nC, 0, 0, null, 1, 1);
  overhang.addLoad(new PointLoad(1, 10));

  const solver = new BeamSolver([overhang, mainSpan]);
  const reactions = solver.updatedGetSupportReactions();

  assertClose("overhang RB", reactionY(reactions, sB.id), 35 / 3);
  assertClose("overhang RC", reactionY(reactions, sC.id), -5 / 3);
}

function runSupportNodalLoadSignConvention() {
  const sA = new PinnedSupport(0, 0);
  const sB = new RollerSupport(6, 0, sA);

  const nA = new Node("A", 0, 0, sA);
  const nB = new Node("B", 6, 0, sB);
  const span = new Beam(nA, nB, 0, 0, null, 1, 1);

  // Positive Fy is upward, so a downward nodal load is negative.
  nB.addNodalLoad(0, -10);

  const solver = new BeamSolver([span]);
  const reactions = solver.updatedGetSupportReactions();

  assertClose("support nodal load RA", reactionY(reactions, sA.id), 0);
  assertClose("support nodal load RB", reactionY(reactions, sB.id), 10);
}

function runPartialVDLSectionCuts() {
  const sA = new FixedSupport(0, 0);

  const nA = new Node("A", 0, 0, sA);
  const nB = new Node("B", 4, 0);
  const span = new Beam(nA, nB, 0, 0, null, 1, 1);
  span.addLoad(new VDL(12, 4, 0, 0));

  const solver = new BeamSolver([span]);
  const reactions = solver.updatedGetSupportReactions();

  assertClose("partial VDL VA", reactionY(reactions, sA.id), 24);
  assertClose("partial VDL MA", reactionM(reactions, sA.id), 64);
  assertClose("partial VDL V(1)", solver.getInternalShear(span, 1), 22.5);
  assertClose("partial VDL M(1)", solver.getInternalMoment(span, 1), -40.5);
  assertClose("partial VDL V(4)", solver.getInternalShear(span, 4), 0);
  assertNearZero("partial VDL M(4)", solver.getInternalMoment(span, 4));
}

function runDoubleOverhangFixedRoller() {
  const sA = new FixedSupport(3, 0);
  const sB = new RollerSupport(9, 0, sA);

  const nE = new Node("E", 0, 0);
  const nA = new Node("A", 3, 0, sA);
  const nB = new Node("B", 9, 0, sB);
  const nF = new Node("F", 12, 0);

  const leftOverhang = new Beam(nE, nA, 0, 0, null, 1, 1);
  const mainSpan = new Beam(nA, nB, 0, 0, null, 1, 1);
  const rightOverhang = new Beam(nB, nF, 0, 0, null, 1, 1);

  leftOverhang.addLoad(new UDL(0, 3, 10));
  rightOverhang.addLoad(new PointLoad(2, 20));

  const solver = new BeamSolver([leftOverhang, mainSpan, rightOverhang]);
  const reactions = solver.updatedGetSupportReactions();

  assertClose("double overhang RA", reactionY(reactions, sA.id), 20);
  assertClose("double overhang RB", reactionY(reactions, sB.id), 30);
  assertClose("double overhang MA", reactionM(reactions, sA.id), -65);

  // About A (x = 3): left UDL resultant contributes +45 ACW, right point load -160 CW.
  const momentResidual =
    reactionM(reactions, sA.id) +
    reactionY(reactions, sB.id) * 6 +
    45 -
    160;
  assertNearZero("double overhang global moment equilibrium", momentResidual);
}

function runReversedSimpleSpanOrientation() {
  const sB = new RollerSupport(6, 0);
  const sA = new PinnedSupport(0, 0, sB);

  const nB = new Node("B", 6, 0, sB);
  const nA = new Node("A", 0, 0, sA);
  const span = new Beam(nB, nA, 0, 0, null, 1, 1);
  span.addLoad(new PointLoad(3, 12));

  const solver = new BeamSolver([span]);
  const moments = solver.updatedGetFinalMoments();
  const reactions = solver.updatedGetSupportReactions();

  const mA = moments.find((m) => m.nodeId === "A");
  const mB = moments.find((m) => m.nodeId === "B");
  assertClose("reverse span A end moment", mA?.leftMoment ?? 0, 0);
  assertClose("reverse span B end moment", mB?.rightMoment ?? 0, 0);
  assertClose("reverse span RA", reactionY(reactions, sA.id), 6);
  assertClose("reverse span RB", reactionY(reactions, sB.id), 6);
}

runSimpleSpanPinnedRoller();
runCantileverFixedFree();
runOverhangFreePinnedRoller();
runSupportNodalLoadSignConvention();
runPartialVDLSectionCuts();
runDoubleOverhangFixedRoller();
runReversedSimpleSpanOrientation();

console.log("Beam determinate regression: PASS");
