import { Beam } from "./member";
import { Node } from "./node";

// --- Support Class ---
export type SupportType = "pinned" | "roller" | "fixed";

const SUPPORT_REACTIONS: Record<SupportType, number> = {
  pinned: 2,
  roller: 1,
  fixed: 3,
};

// export abstract class Support {
//   position: number;
//   type: SupportType;
//   prev: Support | null;
//   next: Support | null;
//   id: number;
//   settlement: number;
//   leftBeam: Beam | null = null;
//   rightBeam: Beam | null = null;
//   rightMoment: number;
//   leftMoment: number;

//   constructor(
//     position: number,
//     type: SupportType,
//     settlement: number = 0,
//     prev: Support | null = null,
//     next: Support | null = null,
//     leftBeam: Beam | null = null,
//     rightBeam: Beam | null = null
//   ) {
//     this.type = type;
//     this.position = position;
//     this.prev = prev;
//     this.next = next;
//     this.id = !this.prev ? 0 : this.prev.id + 1;
//     this.settlement = settlement ?? 0;
//     this.leftBeam = leftBeam;
//     this.rightBeam = rightBeam;
//     this.leftMoment = 0;
//     this.rightMoment = 0;

//     if (prev) prev.next = this;
//     if (next) next.prev = this;
//   }
// }

export abstract class Support {
  readonly type: SupportType;

  x: number;
  y: number;
  settlement: number;

  prev: Support | null;
  next: Support | null;
  id: number;

  leftBeam: Beam | null;
  rightBeam: Beam | null;

  leftMoment: number = 0;
  rightMoment: number = 0;

  node?: Node;

  protected constructor(
    x: number,
    type: SupportType,
    y: number = 0,
    settlement: number = 0,
    prev: Support | null = null,
    next: Support | null = null,
    leftBeam: Beam | null = null,
    rightBeam: Beam | null = null
  ) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.settlement = settlement;

    this.prev = prev;
    this.next = next;
    this.id = prev ? prev.id + 1 : 0;

    this.leftBeam = leftBeam;
    this.rightBeam = rightBeam;

    if (prev) prev.next = this;
    if (next) next.prev = this;
  }
}

export class RollerSupport extends Support {
  readonly allowRotation = true;
  YReaction: number = 0;

  constructor(
    x: number,
    y: number = 0,
    prev: Support | null = null,
    settlement: number = 0,
    leftBeam: Beam | null = null,
    rightBeam: Beam | null = null
  ) {
    super(x, "roller", y, settlement, prev, null, leftBeam, rightBeam);
  }
}

export class PinnedSupport extends Support {
  readonly allowRotation = true;

  XReaction: number = 0;
  YReaction: number = 0;

  constructor(
    x: number,
    y: number = 0,
    prev: Support | null = null,
    settlement: number = 0,
    leftBeam: Beam | null = null,
    rightBeam: Beam | null = null
  ) {
    super(x, "pinned", y, settlement, prev, null, leftBeam, rightBeam);
  }
}

export class FixedSupport extends Support {
  readonly allowRotation = false;

  XReaction: number = 0;
  YReaction: number = 0;
  MomentReaction: number = 0;

  constructor(
    x: number,
    y: number = 0,
    prev: Support | null = null,
    settlement: number = 0,
    leftBeam: Beam | null = null,
    rightBeam: Beam | null = null
  ) {
    super(x, "fixed", y, settlement, prev, null, leftBeam, rightBeam);
  }

  clockwiseMoment() {
    return -this.MomentReaction;
  }

  antiClockwiseMoment() {
    return Math.abs(this.MomentReaction);
  }
}
