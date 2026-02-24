import { ShearDesignEngine } from "./ShearDesignEngine";

console.log("--- BS8110 Shear Design Zoning Verification ---");

const beamData = {
  b: 250,
  d: 460,
  As: 320,
  fcu: 30,
  fyv: 460,
  Asv: 2 * ((Math.PI * Math.pow(8, 2)) / 4),
};

const sfdData = [
  { x: 0.0, V_kN: 150 },
  { x: 0.5, V_kN: 120 },
  { x: 1.0, V_kN: 90 },
  { x: 1.5, V_kN: 65 },
  { x: 2.0, V_kN: 40 },
  { x: 2.5, V_kN: 15 },
  { x: 3.0, V_kN: -20 },
  { x: 3.5, V_kN: -45 },
  { x: 4.0, V_kN: -85 },
  { x: 4.5, V_kN: -130 },
];

const zones = ShearDesignEngine.analyzeBeamRanges(sfdData, beamData);
zones.forEach((zone, idx) => {
  console.log(
    `${idx + 1}. ${zone.instruction} [${zone.condition}, ${zone.status}]`,
  );
});
