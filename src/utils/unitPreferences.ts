import {
  ElasticModulusUnit,
  ForceUnit,
  InertiaUnit,
  LengthUnit,
  LoadingUnit,
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
): AppUnitPreference => ({
  ...DEFAULT_APP_UNITS,
  ...(value || {}),
});

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
