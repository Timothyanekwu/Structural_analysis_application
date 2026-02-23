import { RCCDesignFormulaes } from "./RCCDesignFormulaes";

console.log("--- BS8110 RCC Design Verification ---");

// Example: Beam section 300mm x 600mm
const b = 300; //
const h = 600; //
const cover = 30;
const linkDia = 10;
const barDia = 20;
const fcu = 30; // Cube strength C30
const fy = 460; // High yield steel BS8110
const M = 200; // Design Moment kNm
const slabThickness = 150;

const rcc = new RCCDesignFormulaes(fcu, fy);

console.log(
  `Inputs: b=${b}mm, h=${h}mm, M=${M}kNm, fcu=${fcu}N/mm2, fy=${fy}N/mm2`,
);

// 1. Effective Depth
const d = rcc.calculateEffectiveDepth(h, cover, linkDia, barDia);
console.log(`1. Effective Depth (d): ${d.toFixed(2)} mm`);

// 2. K Factor
const K = rcc.calculateK(M, b, d);
console.log(`2. Moment Factor (K): ${K.toFixed(4)} (Limit K' = 0.156)`);

// 3. Lever Arm
const z = rcc.calculateLeverArm(K, d);
console.log(
  `3. Lever Arm (z): ${z.toFixed(2)} mm (Capped at 0.95d = ${(0.95 * d).toFixed(2)})`,
);

// 4. Neutral Axis
const x = rcc.calculateNeutralAxisDepth(z, d);
console.log(`4. Neutral Axis (x): ${x.toFixed(2)} mm`);

// 5. Area of Steel
const As = rcc.calculateSteelArea(M, z);
console.log(`5. Area of Tension Steel (As): ${As.toFixed(2)} mm2`);

// 6. Limits
const As_min = rcc.calculateAsMin(b, h);
const As_max = rcc.calculateAsMax(b, h);
console.log(
  `6. Limits: As_min=${As_min.toFixed(2)} mm2, As_max=${As_max.toFixed(2)} mm2`,
);

if (As >= As_min && As <= As_max) {
  console.log("Result: PASS - Steel area within BS8110 limits.");
} else {
  console.log("Result: FAIL - Steel area outside limits.");
}
