import { BeamSolver } from "../beamSolver/beamSolver";
import { Beam } from "../elements/member";
import { UDL } from "../elements/load";
import { Node } from "../elements/node";
import { PinnedSupport } from "../elements/support";
import { RCCDesignFormulaes } from "../RCCDesign/RCCDesignFormulaes";

// --- 1. SETUP BEAM PROBLEM ---
console.log("--- 1. SETTING UP BEAM PROBLEM ---");

// Define supports
const supportA = new PinnedSupport(0, 0);
const supportB = new PinnedSupport(2.595, 0, supportA);
const supportC = new PinnedSupport(6.813, 0, supportB);
const supportD = new PinnedSupport(10.713, 0, supportC);
const supportE = new PinnedSupport(13.301, 0, supportD);

// Define nodes
const nodeA = new Node("A", supportA.x, 0, supportA);
const nodeB = new Node("B", supportB.x, 0, supportB);
const nodeC = new Node("C", supportC.x, 0, supportC);
const nodeD = new Node("D", supportD.x, 0, supportD);
const nodeE = new Node("E", supportE.x, 0, supportE);

// Define beams
const beamAB = new Beam(nodeA, nodeB, 250, 500, "L", 1, 1, 150);
const beamBC = new Beam(nodeB, nodeC, 250, 500, "T", 1, 1, 150);
const beamCD = new Beam(nodeC, nodeD, 250, 500, "T", 1, 1, 150);
const beamDE = new Beam(nodeD, nodeE, 250, 500, "L", 1, 1, 150);

// Define loads
beamAB.addLoad(new UDL(0, 2.595, 29.831));
beamBC.addLoad(new UDL(0, 4.218, 38.71));
beamCD.addLoad(new UDL(0, 3.9, 36.897));
beamDE.addLoad(new UDL(0, 2.588, 29.427));

// --- 2. SOLVE FOR MAX MOMENTS ---
console.log("\n--- 2. SOLVING FOR MOMENTS ---");
const solver = new BeamSolver([beamAB, beamBC, beamCD, beamDE]);
const momentResults = solver.getMaxMomentPerSpan(0.1);

console.log("Moment Results per Span:");
momentResults.forEach((res) => {
  console.log(
    `${res.beam}: Max +M = ${res.maxPositiveMoment.toFixed(2)} kNm, Max -M = ${res.maxNegativeMoment.toFixed(2)} kNm`,
  );
});

// --- 3. RCC ZONED DESIGN ---
console.log("\n--- 3. PERFORMING RCC ZONED DESIGN ---");

const fcu = 30; // N/mm2
const fy = 460; // N/mm2
const cover = 25; // mm
const linkDia = 10; // mm
const mainBarDia = 11; // mm
const h = 500; // mm overall depth
const fyv = 460; // N/mm2
const linkBarDia = 8; // mm
const Asv = 2 * ((Math.PI * Math.pow(linkBarDia, 2)) / 4); // 2-legged links

const rcc = new RCCDesignFormulaes(fcu, fy);
const d = rcc.calculateEffectiveDepth(h, cover, linkDia, mainBarDia);
console.log(`Effective Depth (d): ${d.toFixed(2)} mm`);

momentResults.forEach((res, index) => {
  console.log(`\nZoned Design for ${res.beam}:`);

  // Support region (hogging) and span region (sagging) are designed separately.
  const supportMoment = Math.max(0, -res.maxNegativeMoment);
  const spanMoment = Math.max(0, res.maxPositiveMoment);

  const currentBeam = solver.beams[index];
  const spanSectionType =
    currentBeam.type === "L" || currentBeam.type === "T"
      ? currentBeam.type
      : "Rectangular";

  // Beam length is in m from geometry; convert to mm for flange-width expression.
  const continuousSpanLength = currentBeam.length * 1000;

  const zoned = rcc.designBeamByZones({
    supportMoment,
    spanMoment,
    spanSectionType,
    beamWidth: currentBeam.b,
    overallDepth: h,
    concreteCover: cover,
    linkDiameter: linkDia,
    mainBarDiameter: mainBarDia,
    continuousSpanLength,
  });

  console.log(`Support zone type: ${zoned.support.sectionType}`);
  console.log(`Span zone type: ${zoned.span.sectionType}`);
  console.log(`Top steel (support): ${zoned.topSteelRequired?.toFixed(2) ?? "-"} mm^2`);
  console.log(`Bottom steel (span): ${zoned.bottomSteelRequired?.toFixed(2) ?? "-"} mm^2`);
  console.log(`Governing steel: ${zoned.governingSteelRequired?.toFixed(2) ?? "-"} mm^2`);

  if (!zoned.ok && zoned.messages.length > 0) {
    console.log(`Warnings: ${zoned.messages.join(" | ")}`);
  }

  const AsForShear = Math.max(zoned.governingSteelRequired ?? 0, zoned.AsMin);
  const shearZones = solver.getShearDesignZones(currentBeam, {
    b: currentBeam.b,
    d,
    As: AsForShear,
    fcu,
    fyv,
    Asv,
  }, 0.1);

  console.log("Shear detailing:");
  shearZones.forEach((zone) => {
    console.log(`- ${zone.instruction} [${zone.condition}, ${zone.status}]`);
  });
});
