import { Beam, Column, InclinedMember } from "./member";
import { FixedSupport, RollerSupport, PinnedSupport } from "./support";

export const fmtNo = (number: number) => {
  let no = number;
  if (no < 0.0001) {
    return 0;
  }
  no = Number(no.toFixed(2));
  return no;
};

export class Node {
  id: string;
  x: number;
  y: number;
  imposedDx: number;
  imposedDy: number;
  xLoad: number;
  yLoad: number;
  xReaction: number;
  yReaction: number;
  momentLoad: number;
  connectedMembers: {
    member: Beam | Column | InclinedMember;
    isStart: boolean;
    moment: number;
  }[] = [];
  support: FixedSupport | RollerSupport | PinnedSupport | null = null; // FixedSupport | RollerSupport | PinnedSupport | null

  constructor(
    id: string,
    x: number,
    y: number,
    support: FixedSupport | RollerSupport | PinnedSupport | null = null,
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.imposedDx = 0;
    this.imposedDy = 0;
    this.xLoad = 0;
    this.yLoad = 0;
    this.support = support;
    this.xReaction = 0;
    this.yReaction = 0;
    this.momentLoad = 0;

    if (support) {
      support.node = this; // link support to node
    }
  }

  addMember(member: Beam | Column | InclinedMember, isStart: boolean) {
    this.connectedMembers.push({ member, isStart, moment: 0 });
  }

  addMomentLoad(moment: number) {
    this.momentLoad += moment;
  }

  /**
   * Nodal loads in global axes.
   * Positive Fx is to the right, positive Fy is upward.
   */
  addNodalLoad(fx: number = 0, fy: number = 0) {
    this.xLoad += fx;
    this.yLoad += fy;
  }

  addHorizontalLoad(fx: number) {
    this.xLoad += fx;
  }

  addVerticalLoad(fy: number) {
    this.yLoad += fy;
  }

  /**
   * Imposed nodal displacements in global axes.
   * Positive dx follows your model global +x.
   * Positive dy follows the same sign convention used in your model/support settlement.
   * Use this for settlement/translation compatibility modeling at joints.
   */
  addImposedDisplacement(dx: number = 0, dy: number = 0) {
    this.imposedDx += dx;
    this.imposedDy += dy;
  }
}
