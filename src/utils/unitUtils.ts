export type LengthUnit = "m" | "cm" | "mm" | "ft" | "in";
export type ForceUnit = "kN" | "N" | "lb" | "kip";
export type LoadingUnit = "kN/m" | "N/mm" | "lb/ft" | "kip/ft";
export type MomentUnit = "kN*m" | "N*m" | "N*mm" | "lb*ft" | "kip*ft";
export type ElasticModulusUnit = "kN/m^2" | "MPa" | "GPa" | "psi" | "ksi";
export type InertiaUnit = "m^4" | "cm^4" | "mm^4" | "in^4" | "ft^4";

export const LENGTH_UNITS: Record<LengthUnit, number> = {
  m: 1,
  cm: 0.01,
  mm: 0.001,
  ft: 0.3048,
  in: 0.0254,
};

export const FORCE_UNITS: Record<ForceUnit, number> = {
  kN: 1,
  N: 0.001,
  lb: 0.00444822,
  kip: 4.44822,
};

export const LOADING_UNITS: Record<LoadingUnit, number> = {
  "kN/m": 1,
  "N/mm": 1, // 1 N/mm = 1 kN/m
  "lb/ft": 0.0145939, // 1 lb/ft = 0.01459 kN/m
  "kip/ft": 14.5939, // 1 kip/ft = 14.59 kN/m
};

export const MOMENT_UNITS: Record<MomentUnit, number> = {
  "kN*m": 1,
  "N*m": 0.001,
  "N*mm": 0.000001,
  "lb*ft": 0.0013558179483314,
  "kip*ft": 1.3558179483314,
};

// Base unit: kN/m^2
export const ELASTIC_MODULUS_UNITS: Record<ElasticModulusUnit, number> = {
  "kN/m^2": 1,
  MPa: 1000,
  GPa: 1000000,
  psi: 6.894757293168,
  ksi: 6894.757293168,
};

// Base unit: m^4
export const INERTIA_UNITS: Record<InertiaUnit, number> = {
  "m^4": 1,
  "cm^4": 1e-8,
  "mm^4": 1e-12,
  "in^4": 4.162314256e-7,
  "ft^4": 0.0086309748412416,
};

export const convertLength = (
  value: number,
  from: LengthUnit,
  to: LengthUnit = "m",
): number => {
  const inMeters = value * LENGTH_UNITS[from];
  return inMeters / LENGTH_UNITS[to];
};

export const convertForce = (
  value: number,
  from: ForceUnit,
  to: ForceUnit = "kN",
): number => {
  const inKN = value * FORCE_UNITS[from];
  return inKN / FORCE_UNITS[to];
};

export const convertLoading = (
  value: number,
  from: LoadingUnit,
  to: LoadingUnit = "kN/m",
): number => {
  const inKNm = value * LOADING_UNITS[from];
  return inKNm / LOADING_UNITS[to];
};

export const convertMoment = (
  value: number,
  from: MomentUnit,
  to: MomentUnit = "kN*m",
): number => {
  const inKNm = value * MOMENT_UNITS[from];
  return inKNm / MOMENT_UNITS[to];
};

export const convertElasticModulus = (
  value: number,
  from: ElasticModulusUnit,
  to: ElasticModulusUnit = "kN/m^2",
): number => {
  const inBase = value * ELASTIC_MODULUS_UNITS[from];
  return inBase / ELASTIC_MODULUS_UNITS[to];
};

export const convertInertia = (
  value: number,
  from: InertiaUnit,
  to: InertiaUnit = "m^4",
): number => {
  const inBase = value * INERTIA_UNITS[from];
  return inBase / INERTIA_UNITS[to];
};

/**
 * rounds a number to a specified precision, ensuring minimal floating point errors
 */
export const round = (num: number, precision: number = 4) => {
  return Number(Math.round(Number(num + "e" + precision)) + "e-" + precision);
};
