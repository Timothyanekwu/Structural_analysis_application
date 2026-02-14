"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  LengthUnit,
  ForceUnit,
  LoadingUnit,
  MomentUnit,
  ElasticModulusUnit,
  InertiaUnit,
  LENGTH_UNITS,
  FORCE_UNITS,
  LOADING_UNITS,
  MOMENT_UNITS,
  ELASTIC_MODULUS_UNITS,
  INERTIA_UNITS,
  convertLength,
  convertForce,
  convertLoading,
  convertMoment,
  convertElasticModulus,
  convertInertia,
  round,
} from "../utils/unitUtils";

type UnitType =
  | "length"
  | "force"
  | "loading"
  | "moment"
  | "elasticModulus"
  | "inertia";

interface UnitInputProps {
  value: number | "";
  onChange: (val: number | "") => void;
  unitType: UnitType;
  preferredUnit?: string;
  resetSignal?: number;
  label?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  constantMode?: boolean;
  constantValue?: number;
}

export default function UnitInput({
  value,
  onChange,
  unitType,
  preferredUnit,
  resetSignal = 0,
  label,
  className = "",
  placeholder = "0.00",
  disabled = false,
  constantMode = false,
  constantValue = 1,
}: UnitInputProps) {
  // Determine available units based on type
  const units =
    unitType === "length"
      ? Object.keys(LENGTH_UNITS)
      : unitType === "force"
        ? Object.keys(FORCE_UNITS)
        : unitType === "loading"
          ? Object.keys(LOADING_UNITS)
          : unitType === "moment"
            ? Object.keys(MOMENT_UNITS)
            : unitType === "elasticModulus"
              ? Object.keys(ELASTIC_MODULUS_UNITS)
              : Object.keys(INERTIA_UNITS);

  const unitDefault =
    unitType === "length"
      ? "m"
      : unitType === "force"
        ? "kN"
        : unitType === "loading"
          ? "kN/m"
          : unitType === "moment"
            ? "kN*m"
            : unitType === "elasticModulus"
              ? "GPa"
              : "m^4";

  const [currentUnit, setCurrentUnit] = useState<string>(
    preferredUnit && units.includes(preferredUnit) ? preferredUnit : unitDefault,
  );
  const [displayValue, setDisplayValue] = useState<string>("");
  const resolvedDisplayValue = constantMode
    ? round(constantValue, 6).toString()
    : displayValue;

  // Track if we are editing to avoid jumpy updates
  const isEditing = useRef(false);

  useEffect(() => {
    const resolvedDefaultUnit =
      preferredUnit && units.includes(preferredUnit) ? preferredUnit : unitDefault;
    setCurrentUnit(resolvedDefaultUnit);
  }, [resetSignal, preferredUnit, unitDefault, units]);

  // Sync display value when external value changes (and not editing)
  useEffect(() => {
    if (constantMode) return;
    if (!isEditing.current) {
      if (value === "" || value === undefined || value === null) {
        setDisplayValue("");
      } else {
        // Convert base value (always SI: m, kN, kN/m) to current unit for display
        let converted = 0;
        if (unitType === "length") {
          converted = convertLength(
            Number(value),
            "m",
            currentUnit as LengthUnit,
          );
        } else if (unitType === "force") {
          converted = convertForce(
            Number(value),
            "kN",
            currentUnit as ForceUnit,
          );
        } else if (unitType === "moment") {
          converted = convertMoment(
            Number(value),
            "kN*m",
            currentUnit as MomentUnit,
          );
        } else if (unitType === "elasticModulus") {
          converted = convertElasticModulus(
            Number(value),
            "kN/m^2",
            currentUnit as ElasticModulusUnit,
          );
        } else if (unitType === "inertia") {
          converted = convertInertia(
            Number(value),
            "m^4",
            currentUnit as InertiaUnit,
          );
        } else {
          converted = convertLoading(
            Number(value),
            "kN/m",
            currentUnit as LoadingUnit,
          );
        }
        // Avoid aggressive rounding on display to keep precision matching input
        setDisplayValue(round(converted, 6).toString());
      }
    }
  }, [
    value,
    currentUnit,
    unitType,
    constantMode,
  ]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (constantMode) return;
    const val = e.target.value;
    setDisplayValue(val);

    if (val === "") {
      onChange("");
      return;
    }

    const numVal = parseFloat(val);
    if (!isNaN(numVal)) {
      // Convert FROM display unit TO base unit (SI)
      let baseVal = 0;
      if (unitType === "length") {
        baseVal = convertLength(numVal, currentUnit as LengthUnit, "m");
      } else if (unitType === "force") {
        baseVal = convertForce(numVal, currentUnit as ForceUnit, "kN");
      } else if (unitType === "moment") {
        baseVal = convertMoment(numVal, currentUnit as MomentUnit, "kN*m");
      } else if (unitType === "elasticModulus") {
        baseVal = convertElasticModulus(
          numVal,
          currentUnit as ElasticModulusUnit,
          "kN/m^2",
        );
      } else if (unitType === "inertia") {
        baseVal = convertInertia(numVal, currentUnit as InertiaUnit, "m^4");
      } else {
        baseVal = convertLoading(numVal, currentUnit as LoadingUnit, "kN/m");
      }
      onChange(baseVal);
    }
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newUnit = e.target.value;
    setCurrentUnit(newUnit);

    // When unit changes, we want to keep the underlying BASE value same?
    // OR do we want to convert the number in the box?
    // usually: 1 m -> changing unit to cm -> displays 100 cm.
    // The base value (1m) stays same. The display value updates.
    // This is handled by the useEffect above which depends on `currentUnit`.
    // So we just update state and let effect fire.
    // However, if we are currently editing invalid input, effect might behave oddly.
    // But generally safe.
  };

  return (
    <div className={`relative w-full ${className}`}>
      {label && (
        <label className="text-[9px] font-black uppercase text-gray-500 block mb-1 ml-1">
          {label}
        </label>
      )}
      <div className="flex w-full min-w-0">
        <input
          type="number"
          value={resolvedDisplayValue}
          onChange={handleInputChange}
          onFocus={() => {
            isEditing.current = true;
          }}
          onBlur={() => {
            isEditing.current = false;
          }}
          readOnly={constantMode}
          disabled={disabled}
          className={`no-spinner min-w-0 flex-1 bg-black border border-white/10 rounded-l-xl px-4 py-2 text-xs font-bold outline-none transition-colors disabled:opacity-50 ${constantMode ? "cursor-not-allowed text-gray-400" : "focus:border-[var(--primary)] focus:z-10"}`}
          placeholder={placeholder}
        />
        <div className="relative shrink-0 min-w-[4.25rem] border-y border-r border-white/10 rounded-r-xl bg-white/5 hover:bg-white/10 transition-colors">
          <select
            value={currentUnit}
            onChange={handleUnitChange}
            disabled={disabled}
            className="h-full w-full bg-transparent text-[10px] font-black uppercase px-2 py-0 outline-none cursor-pointer appearance-none pr-6 text-gray-400 hover:text-white disabled:opacity-50"
          >
            {units.map((u) => (
              <option key={u} value={u} className="bg-black text-gray-300">
                {u}
              </option>
            ))}
          </select>
          <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
