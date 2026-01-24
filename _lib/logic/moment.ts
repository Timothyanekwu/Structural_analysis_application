import { PointLoad, UDL, VDL } from "../elements/load";

export class Moment {
  getMoment(refPosition: number, load: PointLoad[] | []) {
    // return isClockwise
    //   ? load.magnitude * distance * -1
    //   : load.magnitude * distance;

    const result = load
      ? load.reduce((res, curr) => {
          const distance = Math.abs(curr.position - refPosition);
          const moment =
            curr.position > refPosition
              ? curr.magnitude * distance * -1
              : curr.position < refPosition
              ? curr.magnitude * distance
              : 0;

          return res + moment;
        }, 0)
      : 0;

    return result * -1;
  }
}
