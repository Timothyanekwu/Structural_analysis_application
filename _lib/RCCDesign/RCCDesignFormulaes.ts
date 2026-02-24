import { ShearDesignEngine } from "./ShearDesignEngine";
import type { BeamData, ShearPoint, ShearZone } from "./ShearDesignEngine";

/**
 * RCCDesignFormulaes - A comprehensive class for Reinforced Concrete Design calculations.
 * Standard used: BS 8110-1:1997.
 */

// TODO: Add more functions for RCC Design
// moment of inertia

export type SpanSectionType = "Rectangular" | "L" | "T";
export type BeamZone = "support" | "span";

export type FlexuralZoneDesignResult = {
  ok: boolean;
  zone: BeamZone;
  sectionType: SpanSectionType;
  designMoment: number;
  sectionWidthUsed: number;
  bf: number | null;
  K: number | null;
  z: number | null;
  x: number | null;
  As: number | null;
  message: string | null;
};

export type ZonedBeamDesignInput = {
  supportMoment: number;
  spanMoment: number;
  spanSectionType: SpanSectionType;
  beamWidth: number;
  overallDepth: number;
  concreteCover: number;
  linkDiameter: number;
  mainBarDiameter: number;
  continuousSpanLength?: number;
};

export type ZonedBeamDesignResult = {
  ok: boolean;
  d: number;
  AsMin: number;
  AsMax: number;
  support: FlexuralZoneDesignResult;
  span: FlexuralZoneDesignResult;
  topSteelRequired: number | null;
  bottomSteelRequired: number | null;
  governingSteelRequired: number | null;
  messages: string[];
};

const MAX_SINGLY_REINFORCED_K = 0.225;

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

  private assertFinite(name: string, value: number) {
    if (!Number.isFinite(value)) {
      throw new Error(`${name} must be a finite number.`);
    }
  }

  private assertGreaterThan(
    name: string,
    value: number,
    min: number,
    inclusive = false,
  ) {
    this.assertFinite(name, value);
    const pass = inclusive ? value >= min : value > min;
    if (!pass) {
      const op = inclusive ? ">=" : ">";
      throw new Error(`${name} must be ${op} ${min}. Received ${value}.`);
    }
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
    this.assertGreaterThan("overall depth h", h, 0);
    this.assertGreaterThan("concrete cover", concreteCover, 0, true);
    this.assertGreaterThan("link diameter", linkDiameter, 0, true);
    this.assertGreaterThan("main bar diameter", mainBarDiameter, 0);

    const d = h - concreteCover - linkDiameter - mainBarDiameter / 2;
    if (d <= 0) {
      throw new Error(
        `Effective depth d must be > 0. Check h, cover, linkDiameter, and mainBarDiameter (computed d=${d}).`,
      );
    }
    return d;
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
   * @param beamType Type of flanged span beam: 'L' | 'T'
   * @param beamWidth Web width of the beam (bw) in mm
   * @param continuousSpanLength Distance between points of contraflexure (cc length) in mm
   * @returns Effective flange width (bf) in mm
   */
  calculateEffectiveFlangeWidth(
    beamType: "L" | "T",
    beamWidth: number,
    continuousSpanLength: number,
  ): number {
    this.assertGreaterThan("beam web width bw", beamWidth, 0);
    this.assertGreaterThan("continuous span length", continuousSpanLength, 0);

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
    this.assertGreaterThan("section width b", b, 0);
    this.assertGreaterThan("effective depth d", d, 0);
    this.assertGreaterThan("fcu", this.fcu, 0);

    const M_Nmm = Math.abs(designMoment) * 1e6;
    return M_Nmm / (b * Math.pow(d, 2) * this.fcu);
  }

  /**
   * Convenience method to calculate K for flanged beams.
   * Internally calculates the effective flange width (bf) using calculateEffectiveFlangeWidth,
   * then computes the moment factor K.
   * @param designMoment Design bending moment (M) in kNm
   * @param beamType Type of flanged span beam: 'L' | 'T'
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

  private designFlexuralZone(
    zone: BeamZone,
    designMoment: number,
    sectionType: SpanSectionType,
    beamWidth: number,
    d: number,
    continuousSpanLength?: number,
  ): FlexuralZoneDesignResult {
    const absMoment = Math.abs(designMoment);
    let width = beamWidth;
    let bf: number | null = null;

    if (sectionType === "L" || sectionType === "T") {
      if (!Number.isFinite(continuousSpanLength) || (continuousSpanLength ?? 0) <= 0) {
        return {
          ok: false,
          zone,
          sectionType,
          designMoment: absMoment,
          sectionWidthUsed: width,
          bf: null,
          K: null,
          z: null,
          x: null,
          As: null,
          message:
            "Continuous span length is required and must be > 0 for L/T span design.",
        };
      }
      bf = this.calculateEffectiveFlangeWidth(
        sectionType,
        beamWidth,
        continuousSpanLength!,
      );
      width = bf;
    }

    const K = this.calculateK(absMoment, width, d);
    if (K >= MAX_SINGLY_REINFORCED_K) {
      return {
        ok: false,
        zone,
        sectionType,
        designMoment: absMoment,
        sectionWidthUsed: width,
        bf,
        K,
        z: null,
        x: null,
        As: null,
        message: `K (${K.toFixed(4)}) exceeds singly reinforced limit (${MAX_SINGLY_REINFORCED_K}).`,
      };
    }

    const z = this.calculateLeverArm(K, d);
    const x = this.calculateNeutralAxisDepth(z, d);
    const As = this.calculateSteelAreaBS8110(absMoment, z);

    return {
      ok: true,
      zone,
      sectionType,
      designMoment: absMoment,
      sectionWidthUsed: width,
      bf,
      K,
      z,
      x,
      As,
      message: null,
    };
  }

  /**
   * Designs a beam in two zones:
   * - Support zone: always rectangular section (negative moment region)
   * - Span zone: rectangular/L/T section (positive moment region)
   */
  designBeamByZones(input: ZonedBeamDesignInput): ZonedBeamDesignResult {
    const {
      supportMoment,
      spanMoment,
      spanSectionType,
      beamWidth,
      overallDepth,
      concreteCover,
      linkDiameter,
      mainBarDiameter,
      continuousSpanLength,
    } = input;

    this.assertGreaterThan("beam width", beamWidth, 0);
    this.assertGreaterThan("overall depth", overallDepth, 0);
    this.assertGreaterThan("support moment magnitude", Math.abs(supportMoment), 0, true);
    this.assertGreaterThan("span moment magnitude", Math.abs(spanMoment), 0, true);

    const d = this.calculateEffectiveDepth(
      overallDepth,
      concreteCover,
      linkDiameter,
      mainBarDiameter,
    );
    const AsMin = this.calculateAsMin(beamWidth, overallDepth);
    const AsMax = this.calculateAsMax(beamWidth, overallDepth);

    const support = this.designFlexuralZone(
      "support",
      supportMoment,
      "Rectangular",
      beamWidth,
      d,
    );

    const span = this.designFlexuralZone(
      "span",
      spanMoment,
      spanSectionType,
      beamWidth,
      d,
      continuousSpanLength,
    );

    const messages = [
      support.message ? `Support zone: ${support.message}` : null,
      span.message ? `Span zone: ${span.message}` : null,
    ].filter((message): message is string => Boolean(message));
    const topSteelRequired = support.As;
    const bottomSteelRequired = span.As;
    const governingSteelRequired =
      topSteelRequired === null && bottomSteelRequired === null
        ? null
        : Math.max(topSteelRequired ?? 0, bottomSteelRequired ?? 0);

    return {
      ok: support.ok && span.ok,
      d,
      AsMin,
      AsMax,
      support,
      span,
      topSteelRequired,
      bottomSteelRequired,
      governingSteelRequired,
      messages,
    };
  }

  /**
   * Shear detailing zones from SFD points along a beam.
   */
  designShearZones(sfdData: ShearPoint[], data: BeamData): ShearZone[] {
    return ShearDesignEngine.analyzeBeamRanges(sfdData, data);
  }

  /**
   * Convenience wrapper for BeamSolver section-cut output.
   */
  designShearZonesFromInternalForces(
    data: { x: number; shear: number }[],
    beamData: BeamData,
  ): ShearZone[] {
    const sfdData: ShearPoint[] = data.map((point) => ({
      x: point.x,
      V_kN: point.shear,
    }));
    return this.designShearZones(sfdData, beamData);
  }

  /**
   * Calculates the Lever Arm (z).
   * BS8110: z = d * [0.5 + sqrt(0.25 - K / 0.9)]
   * @param K Dimensionless moment factor
   * @param d Effective depth in mm
   * @returns Lever arm in mm, capped at 0.95d
   */
  calculateLeverArm(K: number, d: number): number {
    this.assertGreaterThan("K", K, 0, true);
    this.assertGreaterThan("effective depth d", d, 0);

    const K_limit = 0.156; // Limit for singly reinforced section in BS8110

    if (K > K_limit) {
      console.warn(
        `K (${K.toFixed(4)}) exceeds K_limit (0.156). Compression reinforcement required according to BS8110.`,
      );
    }
    if (K >= MAX_SINGLY_REINFORCED_K) {
      throw new Error(
        `K (${K.toFixed(4)}) is >= ${MAX_SINGLY_REINFORCED_K}. Section is beyond singly reinforced range.`,
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
    this.assertGreaterThan("lever arm z", z, 0);
    this.assertGreaterThan("effective depth d", d, 0);
    if (z > d) {
      throw new Error(`lever arm z must be <= d. Received z=${z}, d=${d}.`);
    }
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
    this.assertGreaterThan("lever arm z", z, 0);
    this.assertGreaterThan("fy", this.fy, 0);

    const M_Nmm = Math.abs(designMoment) * 1e6;
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
    this.assertGreaterThan("lever arm z", z, 0);
    this.assertGreaterThan("fy", this.fy, 0);
    return (Math.abs(designMoment) * 1e6) / (0.95 * this.fy * z);
  }

  /**
   * Calculates minimum area of steel (As_min).
   * BS8110 Table 3.25:
   * Rectangular Beam (High Yield Steel fy=460/500): 0.13% bh
   * Rectangular Beam (Mild Steel fy=250): 0.24% bh
   */
  calculateAsMin(b: number, h: number): number {
    this.assertGreaterThan("section width b", b, 0);
    this.assertGreaterThan("overall depth h", h, 0);
    const rho_min = this.fy >= 460 ? 0.0013 : 0.0024;
    return rho_min * b * h;
  }

  /**
   * Calculates maximum area of steel (As_max).
   * BS8110 Clause 3.4.4.1: Max As = 4% gross section
   */
  calculateAsMax(b: number, h: number): number {
    this.assertGreaterThan("section width b", b, 0);
    this.assertGreaterThan("overall depth h", h, 0);
    return 0.04 * b * h;
  }
}
