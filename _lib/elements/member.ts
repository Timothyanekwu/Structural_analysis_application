// member.ts

import { PointLoad, UDL, VDL } from "./load";
import { FixedSupport, RollerSupport, PinnedSupport } from "./support";
import { Node } from "./node";

interface EndReactions {
  RxStart: number;
  RyStart: number;
  RxEnd: number;
  RyEnd: number;
}

export abstract class Member {
  startNode: Node;
  endNode: Node;
  loads: (PointLoad | UDL | VDL)[];
  Ecoef: number;
  Icoef: number;
  endReactions: EndReactions;

  constructor(startNode: Node, endNode: Node, Ecoef = 1, Icoef = 1) {
    this.startNode = startNode;
    this.endNode = endNode;
    this.loads = [];
    this.Ecoef = Ecoef;
    this.Icoef = Icoef;
    this.endReactions = {
      RxEnd: 0,
      RyEnd: 0,
      RxStart: 0,
      RyStart: 0,
    };
  }

  get length(): number {
    const dx = this.endNode.x - this.startNode.x;
    const dy = this.endNode.y - this.startNode.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  get angle(): number {
    return Math.atan2(
      this.endNode.y - this.startNode.y,
      this.endNode.x - this.startNode.x
    );
  }

  addLoad(load: PointLoad | UDL | VDL) {
    this.loads.push(load);
  }

  getEquivalentPointLoads(): PointLoad[] {
    const pointLoads: PointLoad[] = [];
    for (const load of this.loads) {
      if (load instanceof PointLoad) pointLoads.push(load);
      else pointLoads.push(load.getResultantLoad());
    }
    return pointLoads;
  }
}

export class Beam extends Member {
  constructor(
    startNode: Node,
    endNode: Node,
    // leftSupport: FixedSupport | RollerSupport | PinnedSupport | null,
    // rightSupport: FixedSupport | RollerSupport | PinnedSupport | null,
    Ecoef = 1,
    Icoef = 1
  ) {
    super(startNode, endNode, Ecoef, Icoef);
    // this.leftSupport = leftSupport;
    // this.rightSupport = rightSupport;

    if (this.startNode.y !== this.endNode.y) {
      throw new Error(
        `Beam must be horizontal: Node${this.startNode.id}.y is not equal to Node${this.endNode.id}.y, 
        Node${this.startNode.id} is ${this.startNode.y} and Node${this.endNode.id} is ${this.endNode.y}  `
      );
    }

    startNode.addMember(this, true);
    endNode.addMember(this, false);
  }
}

export class Column extends Member {
  constructor(startNode: Node, endNode: Node, Ecoef = 1, Icoef = 1) {
    super(startNode, endNode, Ecoef, Icoef);

    if (this.startNode.x !== this.endNode.x) {
      throw new Error(
        `Column must be vertical: Node${this.startNode.id}.x is not equal to Node${this.endNode.id}.x, 
        Node${this.startNode.id}.x is ${this.startNode.x} and Node${this.endNode.id}.x is ${this.endNode.x} `
      );
    }

    startNode.addMember(this, true);
    endNode.addMember(this, false);
  }
}

export class InclinedMember extends Member {
  constructor(startNode: Node, endNode: Node, Ecoef = 1, Icoef = 1) {
    super(startNode, endNode, Ecoef, Icoef);
    if (
      Math.abs(this.angle) < 0.01 ||
      Math.abs(Math.abs(this.angle) - Math.PI / 2) < 0.01
    ) {
      throw new Error("InclinedMember must not be horizontal or vertical");
    }

    startNode.addMember(this, true);
    endNode.addMember(this, false);
  }
}
