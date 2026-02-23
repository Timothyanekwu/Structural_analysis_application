import { BeamSolver } from "../beamSolver/beamSolver";
import { Beam } from "../elements/member";
import { PointLoad, UDL } from "../elements/load";
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

runSimpleSpanPinnedRoller();
runCantileverFixedFree();
runOverhangFreePinnedRoller();

console.log("Beam determinate regression: PASS");
