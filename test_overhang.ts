import { Beam } from "./_lib/elements/member";
import { Node } from "./_lib/elements/node";
import { PointLoad } from "./_lib/elements/load";
import { PinnedSupport, RollerSupport } from "./_lib/elements/support";
import { BeamSolver } from "./_lib/beamSolver/beamSolver";

// Test 1: Load on member
const n1 = new Node("1", 0, 0); // free
const n2 = new Node("2", 2, 0); // pinned
const n3 = new Node("3", 4, 0); // roller
n2.support = new PinnedSupport(2, 0);
n3.support = new RollerSupport(4, 0);

const b1 = new Beam(n1, n2);
const b2 = new Beam(n2, n3);

// Put load on member
b1.addLoad(new PointLoad(10, 0)); // 10 downward at x=0 (node A)

const solver1 = new BeamSolver([b1, b2]);
console.log("Moments with member load:", solver1.updatedGetFinalMoments());
console.log(
  "Reactions with member load:",
  solver1.updatedGetSupportReactions(),
);

// Test 2: Load on Node
const n1a = new Node("1a", 0, 0); // free
const n2a = new Node("2a", 2, 0); // pinned
const n3a = new Node("3a", 4, 0); // roller
n2a.support = new PinnedSupport(2, 0);
n3a.support = new RollerSupport(4, 0);

n1a.yLoad = -10; // 10 downward on node A

const b1a = new Beam(n1a, n2a);
const b2a = new Beam(n2a, n3a);

const solver2 = new BeamSolver([b1a, b2a]);
console.log("Moments with node load:", solver2.updatedGetFinalMoments());
console.log("Reactions with node load:", solver2.updatedGetSupportReactions());
