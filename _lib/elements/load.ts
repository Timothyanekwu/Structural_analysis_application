import { Beam, Column, InclinedMember } from "./member";

// --- PointLoad Class ---
export class PointLoad {
  position: number;
  magnitude: number;
  name: "PointLoad" = "PointLoad";
  // member: Beam | Column | InclinedMember

  constructor(position: number, magnitude: number) {
    this.position = position;
    this.magnitude = magnitude;
  }
}

// --- UDL Class ---
export class UDL {
  startPosition: number;
  span: number;
  magnitudePerMeter: number;
  name: "UDL" = "UDL";

  constructor(startPosition: number, span: number, magnitudePerMeter: number) {
    this.startPosition = startPosition;
    this.span = span;
    this.magnitudePerMeter = magnitudePerMeter;
  }

  getResultantLoad() {
    return new PointLoad(
      this.startPosition + this.span / 2,
      this.span * this.magnitudePerMeter
    );
  }
}

// --- VDL Class ---
export class VDL {
  highMagnitude: number;
  highPosition: number;
  lowMagnitude: number;
  lowPosition: number;
  name: "VDL" = "VDL";

  constructor(
    highMagnitude: number,
    highPosition: number,
    lowMagnitude: number,
    lowPosition: number
  ) {
    this.highMagnitude = highMagnitude;
    this.highPosition = highPosition;
    this.lowMagnitude = lowMagnitude;
    this.lowPosition = lowPosition;
  }

  getResultantLoad() {
    const highPos = this.highPosition;
    const lowPos = this.lowPosition;

    if (highPos === lowPos) {
      throw new Error("High and low positions cannot be the same.");
    }

    const span = Math.abs(highPos - lowPos);
    const addition = span / 3;

    const resultantMagnitude = (span * this.highMagnitude) / 2;
    const resultantPosition =
      highPos < lowPos ? highPos + addition : highPos - addition;

    return new PointLoad(resultantPosition, resultantMagnitude);
  }
}
