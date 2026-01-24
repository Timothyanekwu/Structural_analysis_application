import { Beam, Column, InclinedMember } from "./member";
import { FixedSupport, RollerSupport, PinnedSupport } from "./support";

export const fmtNo = (number: number) => {
  let no = number;
  if (no < 0.0001) {
    return 0;
  }
  no = Number(no.toFixed(2));
  console.log(no, "in fmt fnc");
  return no;
};

export class Node {
  id: string;
  x: number;
  y: number;
  xReaction: number;
  yReaction: number;
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
    support: FixedSupport | RollerSupport | PinnedSupport | null = null
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.support = support;
    this.xReaction = 0;
    this.yReaction = 0;

    if (support) {
      support.node = this; // link support to node
    }
  }

  addMember(member: Beam, isStart: boolean) {
    this.connectedMembers.push({ member, isStart, moment: 0 });
  }
}
