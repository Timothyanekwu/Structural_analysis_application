import {
  ELASTIC_MODULUS_UNITS,
  ElasticModulusUnit,
  FORCE_UNITS,
  ForceUnit,
  INERTIA_UNITS,
  InertiaUnit,
  LENGTH_UNITS,
  LengthUnit,
  LOADING_UNITS,
  LoadingUnit,
  MOMENT_UNITS,
  MomentUnit,
} from "./unitUtils";

export type AppUnitPreference = {
  length: LengthUnit;
  force: ForceUnit;
  loading: LoadingUnit;
  moment: MomentUnit;
  elasticModulus: ElasticModulusUnit;
  inertia: InertiaUnit;
};

export const DEFAULT_APP_UNITS: AppUnitPreference = {
  length: "m",
  force: "kN",
  loading: "kN/m",
  moment: "kN*m",
  elasticModulus: "GPa",
  inertia: "m^4",
};

export const APP_UNITS_STORAGE_KEY = "analysis_default_units_v1";

export const sanitizeDefaultUnits = (
  value?: Partial<AppUnitPreference>,
): AppUnitPreference => {
  const pick = <T extends string>(
    maybe: unknown,
    allowed: Record<T, number>,
    fallback: T,
  ): T => {
    if (typeof maybe !== "string") return fallback;
    return Object.prototype.hasOwnProperty.call(allowed, maybe)
      ? (maybe as T)
      : fallback;
  };

  return {
    length: pick(value?.length, LENGTH_UNITS, DEFAULT_APP_UNITS.length),
    force: pick(value?.force, FORCE_UNITS, DEFAULT_APP_UNITS.force),
    loading: pick(value?.loading, LOADING_UNITS, DEFAULT_APP_UNITS.loading),
    moment: pick(value?.moment, MOMENT_UNITS, DEFAULT_APP_UNITS.moment),
    elasticModulus: pick(
      value?.elasticModulus,
      ELASTIC_MODULUS_UNITS,
      DEFAULT_APP_UNITS.elasticModulus,
    ),
    inertia: pick(value?.inertia, INERTIA_UNITS, DEFAULT_APP_UNITS.inertia),
  };
};

export const loadStoredDefaultUnits = (): AppUnitPreference => {
  if (typeof window === "undefined") return DEFAULT_APP_UNITS;
  try {
    const raw = window.localStorage.getItem(APP_UNITS_STORAGE_KEY);
    if (!raw) return DEFAULT_APP_UNITS;
    return sanitizeDefaultUnits(JSON.parse(raw) as Partial<AppUnitPreference>);
  } catch {
    return DEFAULT_APP_UNITS;
  }
};

export const saveDefaultUnits = (units: AppUnitPreference): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APP_UNITS_STORAGE_KEY, JSON.stringify(units));
};
