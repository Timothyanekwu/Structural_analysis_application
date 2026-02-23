// --- 1. DEFINE TYPES FOR INPUT & OUTPUT ---

export interface ColumnInput {
  load_kN: number; // Axial Design Load
  width_mm: number; // Dimension 'b'
  depth_mm: number; // Dimension 'h'
  clearHeight_mm: number; // Floor-to-ceiling height
  fcu?: number; // Concrete Grade (Default 30)
  fy?: number; // Steel Grade (Default 460)
}

export interface DesignResult {
  status: "SUCCESS" | "TERMINATED";
  message: string;
  steelRequiredArea?: number; // Asc required
  providedSteel?: string; // e.g., "4 Y16"
  providedArea?: number; // Actual area provided
  links?: string; // e.g., "R8 @ 190mm c/c"
  utilizationRatio?: number; // How hard the column is working
}



// --- 2. THE ENGINE LOGIC ---

export function designShortBracedColumn(input: ColumnInput): DesignResult {
  // A. DESTRUCTURE & SET DEFAULTS
  const { load_kN, width_mm, depth_mm, clearHeight_mm } = input;
  const fcu = input.fcu || 30; // Default 30 N/mm2
  const fy = input.fy || 460; // Default 460 N/mm2 (High Yield)

  // B. GEOMETRY CHECKS (BS 8110 Clause 3.8.1.3)
  // For Braced columns, effective height (le) is approx 0.85 * clear height
  const le = 0.85 * clearHeight_mm;
  const minDim = Math.min(width_mm, depth_mm);
  const slendernessRatio = le / minDim;

  // STOP: If Slenderness > 15, we cannot use Short Column logic
  if (slendernessRatio > 15) {
    return {
      status: "TERMINATED",
      message: `CRITICAL: Column is Slender (Ratio: ${slendernessRatio.toFixed(1)} > 15). Use Slender Column Module.`,
    };
  }

  // C. CALCULATE STEEL AREA (BS 8110 Equation 38)
  // Formula: N = 0.4*fcu*Ac + 0.8*fy*Asc
  // Rearranged: Asc = (N - 0.4*fcu*Ag) / (0.8*fy - 0.4*fcu)

  const N_Newton = load_kN * 1000;
  const Ag = width_mm * depth_mm; // Gross Area

  const termConcrete = 0.4 * fcu * Ag;
  const numerator = N_Newton - termConcrete;
  const denominator = 0.8 * fy - 0.4 * fcu;

  let Asc_required = numerator / denominator;

  // D. MINIMUM STEEL CHECK (Clause 3.12.5)
  // Min steel = 0.4% of Gross Area (Ag)
  const Asc_min = 0.004 * Ag;

  // If calculated area is negative (concrete is strong enough), use min area
  if (Asc_required < Asc_min) {
    Asc_required = Asc_min;
  }

  // E. MAXIMUM STEEL CHECK (Clause 3.12.6)
  // Max steel = 6% of Gross Area (Ag)
  const Asc_max = 0.06 * Ag;

  if (Asc_required > Asc_max) {
    return {
      status: "TERMINATED",
      message: `FAILURE: Section Too Small. Required steel (${Math.ceil(Asc_required)}mm2) exceeds 6% limit. Resize Column.`,
    };
  }

  // F. BAR SELECTION ITERATOR
  // We need to find the best combination of bars that fits
  const barSizes = [12, 16, 20, 25, 32];
  let finalDesign = null;

  for (const bar of barSizes) {
    const areaOneBar = (Math.PI * Math.pow(bar, 2)) / 4;
    let numBars = Math.ceil(Asc_required / areaOneBar);

    // Constraint 1: Minimum 4 bars for rectangular column
    if (numBars < 4) numBars = 4;

    // Constraint 2: Must be Even number (for symmetry in rect columns)
    if (numBars % 2 !== 0) numBars++;

    // Constraint 3: Practical Limit (Try not to exceed 8 bars unless necessary)
    if (numBars <= 8 || bar === 32) {
      finalDesign = {
        count: numBars,
        size: bar,
        area: numBars * areaOneBar,
      };
      break; // Found a valid design, stop looping
    }
  }

  // Fallback (just in case logic misses, extremely rare given max check)
  if (!finalDesign) {
    finalDesign = { count: 8, size: 32, area: 8 * ((Math.PI * 32 ** 2) / 4) };
  }

  // G. LINKS (STIRRUPS) CALCULATION
  // Rule 1: Diameter >= 6mm OR 1/4 of main bar
  let linkDia = Math.max(6, finalDesign.size / 4);
  linkDia = linkDia > 8 ? 10 : 8; // Round to standard R8 or R10

  // Rule 2: Spacing <= 12 * smallest main bar
  const linkSpacing = 12 * finalDesign.size;

  // --- 3. RETURN SUCCESSFUL DESIGN ---
  return {
    status: "SUCCESS",
    message: "Design Complete (BS 8110)",
    steelRequiredArea: Math.ceil(Asc_required),
    providedSteel: `${finalDesign.count} Y${finalDesign.size}`,
    providedArea: Math.ceil(finalDesign.area),
    links: `R${linkDia} @ ${linkSpacing}mm c/c`,
    utilizationRatio: parseFloat((Asc_required / finalDesign.area).toFixed(2)),
  };
}
