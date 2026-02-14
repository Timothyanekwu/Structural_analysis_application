/**
 * Utility functions for calculating section properties of structural members.
 */
export class SectionUtils {
  /**
   * Calculates the Moment of Inertia (I) for a rectangular section.
   * I = (b * (h - slabThickness)^3) / 12
   * @param b Width of the section
   * @param h Height (Total Depth) of the section
   * @param slabThickness Thickness of the slab (default 0)
   */
  static momentOfInertia(
    b: number,
    h: number,
    slabThickness: number = 0,
  ): number {
    const effectiveDepth = h - slabThickness;
    return (b * Math.pow(effectiveDepth, 3)) / 12;
  }

  /**
   * Calculates the Moment of Inertia (I) for a T-Beam section.
   * This is a simplified approximation or placeholder for future complex logic.
   * For accurate analysis, one needs the neutral axis depth.
   *
   * @param bw Web width
   * @param h Overall depth
   * @param bf Effective flange width
   * @param hf Flange thickness (slab thickness)
   */
  //   static calculateTBeamInertia(
  //     bw: number,
  //     h: number,
  //     bf: number,
  //     hf: number,
  //   ): number {
  //     // 1. Calculate Centroid (y_bar) from top
  //     // Area 1 (Flange): bf * hf
  //     // Area 2 (Web): bw * (h - hf)
  //     const A1 = bf * hf;
  //     const y1 = hf / 2;
  //     const A2 = bw * (h - hf);
  //     const y2 = hf + (h - hf) / 2;

  //     const totalArea = A1 + A2;
  //     const y_bar = (A1 * y1 + A2 * y2) / totalArea;

  //     // 2. Parallel Axis Theorem: I = I_local + A * d^2
  //     const I1 = (bf * Math.pow(hf, 3)) / 12 + A1 * Math.pow(y_bar - y1, 2);
  //     const I2 = (bw * Math.pow(h - hf, 3)) / 12 + A2 * Math.pow(y2 - y_bar, 2);

  //     return I1 + I2;
  //   }

  /**
   * Calculates the Moment of Inertia (I) for an L-Beam section.
   * Similar logic to T-Beam.
   */
  //   static calculateLBeamInertia(
  //     bw: number,
  //     h: number,
  //     bf: number,
  //     hf: number,
  //   ): number {
  //     // Logic is identical to T-beam for calculation of Ixx if bf is the total width
  //     return this.calculateTBeamInertia(bw, h, bf, hf);
  //   }
}
