export interface BeamData {
  b: number; // breadth of section (mm)
  d: number; // effective depth (mm)
  As: number; // area of tension steel provided (mm^2)
  fcu: number; // concrete characteristic strength (N/mm^2)
  fyv: number; // link characteristic strength (N/mm^2)
  Asv: number; // area of two legs of shear links (mm^2)
}

export interface ShearPoint {
  x: number; // beam coordinate (usually m)
  V_kN: number; // shear force at x (kN)
}

export interface ShearZone {
  startX: number;
  endX: number;
  condition: string;
  providedSpacing: number; // mm
  instruction: string;
  status: "OK" | "WARNING" | "FAIL";
}

type ShearCondition = "Condition (i)" | "Condition (ii)" | "Condition (iii)" | "FAIL";

type EvaluatedPoint = {
  x: number;
  condition: ShearCondition;
  spacing: number;
  status: "OK" | "WARNING" | "FAIL";
  Vabs: number;
};

type ShearThresholds = {
  vc: number;
  V_nominal_limit: number;
  V_min_limit: number;
  V_fail_limit: number;
  maxPracticalSpacing: number;
  minLinksSpacing: number;
};

export class ShearDesignEngine {
  private static readonly EPS = 1e-9;
  private static readonly MIN_BUILDABLE_SPACING_MM = 100;

  private static assertFinitePositive(name: string, value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${name} must be a finite number > 0. Received: ${value}`);
    }
  }

  private static validateBeamData(data: BeamData) {
    this.assertFinitePositive("b", data.b);
    this.assertFinitePositive("d", data.d);
    this.assertFinitePositive("As", data.As);
    this.assertFinitePositive("fcu", data.fcu);
    this.assertFinitePositive("fyv", data.fyv);
    this.assertFinitePositive("Asv", data.Asv);
  }

  private static normalizeSfdData(sfdData: ShearPoint[]): ShearPoint[] {
    const byX = new Map<number, ShearPoint>();

    for (const point of sfdData) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.V_kN)) {
        continue;
      }

      const existing = byX.get(point.x);
      if (!existing || Math.abs(point.V_kN) > Math.abs(existing.V_kN)) {
        byX.set(point.x, point);
      }
    }

    return Array.from(byX.values()).sort((a, b) => a.x - b.x);
  }

  private static calculateThresholds(data: BeamData): ShearThresholds {
    const { b, d, As, fcu, fyv, Asv } = data;

    // BS 8110 concrete shear stress estimate
    const steelPercentage = Math.min((100 * As) / (b * d), 3.0);
    const depthFactor = Math.max(400 / d, 1.0);
    const vc =
      (0.79 * Math.pow(steelPercentage, 1 / 3) * Math.pow(depthFactor, 1 / 4)) /
      1.25;

    const vmax_stress = Math.min(0.8 * Math.sqrt(fcu), 5.0);

    // Convert stress limits to force limits in kN
    const V_nominal_limit = (0.5 * vc * b * d) / 1000;
    const V_min_limit = ((vc + 0.4) * b * d) / 1000;
    const V_fail_limit = (vmax_stress * b * d) / 1000;

    const maxPracticalSpacing = Math.max(1, Math.floor(Math.min(300, 0.75 * d)));
    const minLinksSpacing = Math.max(
      1,
      Math.floor((Asv * 0.95 * fyv) / (0.4 * b)),
    );

    return {
      vc,
      V_nominal_limit,
      V_min_limit,
      V_fail_limit,
      maxPracticalSpacing,
      minLinksSpacing,
    };
  }

  private static evaluatePoint(
    point: ShearPoint,
    thresholds: ShearThresholds,
    data: BeamData,
  ): EvaluatedPoint {
    const { b, d, fyv, Asv } = data;
    const V_abs = Math.abs(point.V_kN);

    if (V_abs > thresholds.V_fail_limit + this.EPS) {
      return {
        x: point.x,
        condition: "FAIL",
        spacing: 0,
        status: "FAIL",
        Vabs: V_abs,
      };
    }

    if (V_abs <= thresholds.V_nominal_limit + this.EPS) {
      return {
        x: point.x,
        condition: "Condition (i)",
        spacing: thresholds.maxPracticalSpacing,
        status: "OK",
        Vabs: V_abs,
      };
    }

    if (V_abs <= thresholds.V_min_limit + this.EPS) {
      const spacing = Math.max(
        1,
        Math.floor(
          Math.min(thresholds.minLinksSpacing, thresholds.maxPracticalSpacing),
        ),
      );
      return {
        x: point.x,
        condition: "Condition (ii)",
        spacing,
        status:
          spacing < this.MIN_BUILDABLE_SPACING_MM ? "WARNING" : "OK",
        Vabs: V_abs,
      };
    }

    // Condition (iii): higher shear range
    const v_actual = (V_abs * 1000) / (b * d);
    const stressDiff = v_actual - thresholds.vc;
    if (stressDiff <= this.EPS) {
      // Numerically defensive fallback
      return {
        x: point.x,
        condition: "Condition (iii)",
        spacing: thresholds.maxPracticalSpacing,
        status: "WARNING",
        Vabs: V_abs,
      };
    }

    const calculatedSpacing = (Asv * 0.95 * fyv) / (b * stressDiff);
    const spacing = Math.max(
      1,
      Math.floor(Math.min(calculatedSpacing, thresholds.maxPracticalSpacing)),
    );

    return {
      x: point.x,
      condition: "Condition (iii)",
      spacing,
      status: spacing < this.MIN_BUILDABLE_SPACING_MM ? "WARNING" : "OK",
      Vabs: V_abs,
    };
  }

  public static analyzeBeamRanges(
    sfdData: ShearPoint[],
    data: BeamData,
  ): ShearZone[] {
    this.validateBeamData(data);

    const points = this.normalizeSfdData(sfdData);
    if (!points.length) return [];

    const thresholds = this.calculateThresholds(data);
    const evaluatedPoints = points.map((point) =>
      this.evaluatePoint(point, thresholds, data),
    );

    const zones: ShearZone[] = [];
    if (evaluatedPoints.length === 1) {
      const only = evaluatedPoints[0];
      const zone: ShearZone = {
        startX: only.x,
        endX: only.x,
        condition: only.condition,
        providedSpacing: only.spacing,
        status: only.status,
        instruction: "",
      };
      zone.instruction = this.generateInstructionText(zone);
      return [zone];
    }

    // Build segments between adjacent SFD points.
    // Conservative control: use the endpoint with higher |V|.
    const segments: Array<Omit<ShearZone, "instruction">> = [];
    for (let i = 0; i < evaluatedPoints.length - 1; i++) {
      const left = evaluatedPoints[i];
      const right = evaluatedPoints[i + 1];
      const control = left.Vabs >= right.Vabs ? left : right;
      segments.push({
        startX: left.x,
        endX: right.x,
        condition: control.condition,
        providedSpacing: control.spacing,
        status: control.status,
      });
    }

    let current: ShearZone = {
      ...segments[0],
      instruction: "",
    };

    for (let i = 1; i < segments.length; i++) {
      const segment = segments[i];
      const sameRequirement =
        segment.condition === current.condition &&
        segment.providedSpacing === current.providedSpacing &&
        segment.status === current.status;

      if (sameRequirement) {
        current.endX = segment.endX;
      } else {
        current.instruction = this.generateInstructionText(current);
        zones.push(current);
        current = { ...segment, instruction: "" };
      }
    }

    current.instruction = this.generateInstructionText(current);
    zones.push(current);

    if (zones.length === 1 && zones[0].status !== "FAIL") {
      zones[0].instruction = `Provide 2-legs at ${zones[0].providedSpacing}mm c/c stirrups throughout.`;
    }

    return zones;
  }

  private static generateInstructionText(zone: ShearZone): string {
    if (zone.status === "FAIL") {
      return `From x = ${zone.startX}m to x = ${zone.endX}m: SECTION FAILS SHEAR. Increase b or d.`;
    }
    return `From x = ${zone.startX}m to x = ${zone.endX}m, provide 2-legs at ${zone.providedSpacing}mm c/c stirrups.`;
  }
}
