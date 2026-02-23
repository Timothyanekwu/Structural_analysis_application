import { BeamSolver } from "../beamSolver/beamSolver";
import { Beam } from "../elements/member";
import { Node } from "../elements/node";
import { PinnedSupport, RollerSupport } from "../elements/support";
import { UDL } from "../elements/load";
import { RCCDesignFormulaes } from "../RCCDesign/RCCDesignFormulaes";

// --- 1. SETUP BEAM PROBLEM ---
console.log("--- 1. SETTING UP BEAM PROBLEM ---");

// Define Supports
const supportA = new PinnedSupport(0, 0);
const supportB = new PinnedSupport(2.595, 0, supportA);
const supportC = new PinnedSupport(6.813, 0, supportB);
const supportD = new PinnedSupport(10.713, 0, supportC);
const supportE = new PinnedSupport(13.301, 0, supportD);

// Define Nodes
const nodeA = new Node("A", supportA.x, 0, supportA);
const nodeB = new Node("B", supportB.x, 0, supportB);
const nodeC = new Node("C", supportC.x, 0, supportC);
const nodeD = new Node("D", supportD.x, 0, supportD);
const nodeE = new Node("E", supportE.x, 0, supportE);

// Define Beams
const beamAB = new Beam(nodeA, nodeB, 250, 500, "L", 1, 1, 150);
const beamBC = new Beam(nodeB, nodeC, 250, 500, "T", 1, 1, 150);
const beamCD = new Beam(nodeC, nodeD, 250, 500, "T", 1, 1, 150);
const beamDE = new Beam(nodeD, nodeE, 250, 500, "L", 1, 1, 150);

// Define Loads (UDL 20 kN/m on both spans)
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

// --- 3. RCC DESIGN ---
console.log("\n--- 3. PERFORMING RCC DESIGN ---");

// Common Design Parameters
const fcu = 30; // N/mm2
const fy = 460; // N/mm2
const cover = 25; // mm
const linkDia = 10; // mm
const mainBarDia = 11; // mm (Assume)
const h = 500; // mm (Overall depth)
const slabThickness = 150; // mm (slab thickness)

const rcc = new RCCDesignFormulaes(fcu, fy);

// Calculate Effective Depth
const d = rcc.calculateEffectiveDepth(h, cover, linkDia, mainBarDia);
console.log(`Effective Depth (d): ${d} mm`);

momentResults.forEach((res, index) => {
  console.log(`\nDefaulting Design for ${res.beam}:`);

  // Pick the critical moment (max absolute value) or design for both regions
  // Let's design for max sagging (Mid-span)
  const M_sagging = Math.max(0, res.maxPositiveMoment);

  const beams = solver.beams;
  const currentBeam = beams[index];
  const type = currentBeam.type; // "L" or "T" or null
  const bw = currentBeam.b;
  // Span is roughly the length of the beam.
  // Ideally, span for 'bf' calculation in continuous beams is different (lo),
  // but let's use the beam length for now as an approximation or fixed value.
  const span = currentBeam.length * 1000; // convert m to mm? currentBeam.length is in local units?
  // Coordinate units seem to be meters based on node positions (0 -> 13.3).
  // So span should be converted to mm.

  if (type === "L" || type === "T") {
    console.log(
      `Designing as ${type}-Beam (bw=${bw}mm, span=${span}mm) for M=${M_sagging.toFixed(2)} kNm`,
    );

    const designResult = rcc.calculateKForFlangedBeam(
      M_sagging,
      type,
      bw,
      span,
      d,
    );
    console.log(
      `Effective Flange Width (bf): ${designResult.bf.toFixed(2)} mm`,
    );
    console.log(`K Factor: ${designResult.K.toFixed(4)}`);

    const z = rcc.calculateLeverArm(designResult.K, d);
    console.log(`Lever Arm (z): ${z.toFixed(2)} mm`);

    const As = rcc.calculateSteelArea(M_sagging, z);
    console.log(`Required Steel Area (As): ${As.toFixed(2)} mm²`);
  } else {
    // Rectangular design
    console.log(
      `Designing as Rectangular Beam (b=${bw}mm) for M=${M_sagging.toFixed(2)} kNm`,
    );

    const K = rcc.calculateK(M_sagging, bw, d);
    console.log(`K Factor: ${K.toFixed(4)}`);

    const z = rcc.calculateLeverArm(K, d);
    console.log(`Lever Arm (z): ${z.toFixed(2)} mm`);

    const As = rcc.calculateSteelArea(M_sagging, z);
    console.log(`Required Steel Area (As): ${As.toFixed(2)} mm²`);
  }
});
