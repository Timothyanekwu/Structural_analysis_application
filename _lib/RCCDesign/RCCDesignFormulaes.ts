/**
 * RCCDesignFormulaes - A comprehensive class for Reinforced Concrete Design calculations.
 * Standard used: BS 8110-1:1997.
 */

// TODO: Add more functions for RCC Design
// moment of inertia

export class RCCDesignFormulaes {
  fcu: number;
  fy: number;

  /**
   * @param fcu Characteristic cube strength of concrete in N/mm²
   * @param fy Characteristic yield strength of reinforcement in N/mm²
   
   */
  constructor(fcu: number, fy: number) {
    this.fcu = fcu;
    this.fy = fy;
  }

  /**
   * Calculates the Effective Depth (d) of a section.
   * @param h Overall depth of the section (mm) - depth of slab + beam own depth
   * @param concreteCover Nominal cover to reinforcement (mm)
   * @param linkDiameter Diameter of shear links (mm)
   * @param mainBarDiameter Diameter of main longitudinal bars (mm)
   */

  calculateEffectiveDepth(
    h: number,
    concreteCover: number,
    linkDiameter: number,
    mainBarDiameter: number,
  ): number {
    return h - concreteCover - linkDiameter - mainBarDiameter / 2;
  }

  /**
   * Calculates the Moment Factor (K).
   * BS8110: K = M / (b * d^2 * fcu)
   * @param designMoment Design bending moment (M) in kNm
   * @param b Width of section in mm
   * @param d Effective depth in mm
   */

  /**
   * Calculates the Effective Flange Width (bf) for flanged beams.
   * BS8110: Lz = 0.7 * continuous span length (or distance between points of contraflexure)
   * @param beamType Type of beam: 'support' | 'L' | 'T' | 'rectangular'
   * @param beamWidth Web width of the beam (bw) in mm
   * @param continuousSpanLength Distance between points of contraflexure (cc length) in mm
   * @returns Effective flange width (bf) in mm
   */
  calculateEffectiveFlangeWidth(
    beamType: "L" | "T",
    beamWidth: number,
    continuousSpanLength: number,
  ): number {
    const Lz = 0.7 * continuousSpanLength;

    switch (beamType) {
      case "L":
        // For L-beam: bf = bw + (Lz / 10)
        return beamWidth + Lz / 10;
      case "T":
        // For T-beam: bf = bw + (Lz / 5)
        return beamWidth + Lz / 5;
      default:
        return beamWidth;
    }
  }

  /**
   * Calculates the Moment Factor (K).
   * BS8110: K = M / (b * d^2 * fcu)
   * @param designMoment Design bending moment (M) in kNm
   * @param b Width of section in mm (use bf from calculateEffectiveFlangeWidth for flanged beams)
   * @param d Effective depth in mm
   */
  calculateK(designMoment: number, b: number, d: number): number {
    const M_Nmm = designMoment * 1e6;
    return M_Nmm / (b * Math.pow(d, 2) * this.fcu);
  }

  /**
   * Convenience method to calculate K for flanged beams.
   * Internally calculates the effective flange width (bf) using calculateEffectiveFlangeWidth,
   * then computes the moment factor K.
   * @param designMoment Design bending moment (M) in kNm
   * @param beamType Type of beam: 'support' | 'L' | 'T' | 'rectangular'
   * @param beamWidth Web width of the beam (bw) in mm
   * @param continuousSpanLength Distance between points of contraflexure (cc length) in mm
   * @param d Effective depth in mm
   * @returns Object containing { K, bf } - moment factor and effective flange width
   */
  calculateKForFlangedBeam(
    designMoment: number,
    beamType: "L" | "T",
    beamWidth: number,
    continuousSpanLength: number,
    d: number,
  ): { K: number; bf: number } {
    const bf = this.calculateEffectiveFlangeWidth(
      beamType,
      beamWidth,
      continuousSpanLength,
    );
    const K = this.calculateK(designMoment, bf, d);
    return { K, bf };
  }

  /**
   * Calculates the Lever Arm (z).
   * BS8110: z = d * [0.5 + sqrt(0.25 - K / 0.9)]
   * @param K Dimensionless moment factor
   * @param d Effective depth in mm
   * @returns Lever arm in mm, capped at 0.95d
   */
  calculateLeverArm(K: number, d: number): number {
    const K_limit = 0.156; // Limit for singly reinforced section in BS8110

    if (K > K_limit) {
      console.warn(
        `K (${K.toFixed(4)}) exceeds K_limit (0.156). Compression reinforcement required according to BS8110.`,
      );
    }

    // Lever arm formula from BS8110 simplified equations
    const z = d * (0.5 + Math.sqrt(0.25 - K / 0.9));

    // Limit z to 0.95d as per BS8110
    return Math.min(z, 0.95 * d);
  }

  /**
   * Calculates the Neutral Axis Depth (x).
   * BS8110: From lever arm z = d - 0.45x => x = (d - z) / 0.45
   * @param z Lever arm in mm
   * @param d Effective depth in mm
   */
  calculateNeutralAxisDepth(z: number, d: number): number {
    return (d - z) / 0.45;
  }

  /**
   * Calculates the Required Area of Tension Steel (As).
   * BS8110: As = M / (0.95 * fy * z)
   * @param designMoment Design bending moment (M) in kNm
   * @param z Lever arm in mm
   * @returns Area of steel in mm²
   */
  calculateSteelArea(designMoment: number, z: number): number {
    const M_Nmm = designMoment * 1e6;
    // BS8110 uses 0.95fy for reinforcement design strength (1 / 1.05 safety factor? No, BS8110 usually 0.87fy)
    // Actually BS 8110-1:1997 Figure 2.1 shows 0.95fy/gamma_m.
    // For reinforcement gamma_m = 1.05? 1/1.05 = 0.95.
    // Wait, let's stick to the common BS8110 simplified formula: As = M / (0.95 * fy * z)
    // OR As = M / (0.87 * fy * z) depending on specific code clause.
    // Standard BS8110 Beams: f_y/gamma_s = f_y/1.15 = 0.87f_y.
    // However, some versions use  0.95f_y. I will use 0.95 if it's the requested "Specifically BS8110".
    // Re-checking BS8110:1997 Clause 3.4.4.4: As = M / (0.95 * fy * z)
    return M_Nmm / (0.95 * this.fy * z);
  }

  /**
   * Calculates the tension steel requirement for BS8110
   */
  calculateSteelAreaBS8110(designMoment: number, z: number): number {
    return (designMoment * 1e6) / (0.95 * this.fy * z);
  }

  /**
   * Calculates minimum area of steel (As_min).
   * BS8110 Table 3.25:
   * Rectangular Beam (High Yield Steel fy=460/500): 0.13% bh
   * Rectangular Beam (Mild Steel fy=250): 0.24% bh
   */
  calculateAsMin(b: number, h: number): number {
    const rho_min = this.fy >= 460 ? 0.0013 : 0.0024;
    return rho_min * b * h;
  }

  /**
   * Calculates maximum area of steel (As_max).
   * BS8110 Clause 3.4.4.1: Max As = 4% gross section
   */
  calculateAsMax(b: number, h: number): number {
    return 0.04 * b * h;
  }
}
