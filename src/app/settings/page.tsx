"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ElasticModulusUnit,
  ForceUnit,
  InertiaUnit,
  LengthUnit,
  LoadingUnit,
  MomentUnit,
} from "@/utils/unitUtils";
import {
  AppUnitPreference,
  DEFAULT_APP_UNITS,
  loadStoredDefaultUnits,
  saveDefaultUnits,
} from "@/utils/unitPreferences";

export default function SettingsPage() {
  const [units, setUnits] = useState<AppUnitPreference>(loadStoredDefaultUnits);
  const [savedAt, setSavedAt] = useState<string>("");

  const save = () => {
    saveDefaultUnits(units);
    setSavedAt(new Date().toLocaleTimeString());
  };

  const reset = () => {
    setUnits(DEFAULT_APP_UNITS);
    saveDefaultUnits(DEFAULT_APP_UNITS);
    setSavedAt(new Date().toLocaleTimeString());
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="sticky top-0 z-10 border-b border-white/5 glassy-panel">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">
              Structuro System
            </p>
            <h1 className="text-2xl font-black uppercase tracking-tight">
              Unit Settings
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/analysis?type=beams"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:bg-white/10"
            >
              Beam Workspace
            </Link>
            <Link
              href="/analysis?type=frames"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:bg-white/10"
            >
              Frame Workspace
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
          <p className="mb-6 text-xs font-bold uppercase tracking-widest text-gray-500">
            Set app-wide defaults used by member forms and result unit resets
          </p>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-2 ml-1 block text-[9px] font-black uppercase tracking-widest text-gray-500">
                Length
              </label>
              <select
                value={units.length}
                onChange={(e) =>
                  setUnits((prev) => ({
                    ...prev,
                    length: e.target.value as LengthUnit,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-xs font-bold uppercase outline-none"
              >
                {(["m", "cm", "mm", "ft", "in"] as LengthUnit[]).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 ml-1 block text-[9px] font-black uppercase tracking-widest text-gray-500">
                Force
              </label>
              <select
                value={units.force}
                onChange={(e) =>
                  setUnits((prev) => ({
                    ...prev,
                    force: e.target.value as ForceUnit,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-xs font-bold uppercase outline-none"
              >
                {(["kN", "N", "lb", "kip"] as ForceUnit[]).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 ml-1 block text-[9px] font-black uppercase tracking-widest text-gray-500">
                Loading
              </label>
              <select
                value={units.loading}
                onChange={(e) =>
                  setUnits((prev) => ({
                    ...prev,
                    loading: e.target.value as LoadingUnit,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-xs font-bold uppercase outline-none"
              >
                {(["kN/m", "N/mm", "lb/ft", "kip/ft"] as LoadingUnit[]).map(
                  (u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div>
              <label className="mb-2 ml-1 block text-[9px] font-black uppercase tracking-widest text-gray-500">
                Moment
              </label>
              <select
                value={units.moment}
                onChange={(e) =>
                  setUnits((prev) => ({
                    ...prev,
                    moment: e.target.value as MomentUnit,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-xs font-bold uppercase outline-none"
              >
                {(
                  ["kN*m", "N*m", "N*mm", "lb*ft", "kip*ft"] as MomentUnit[]
                ).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 ml-1 block text-[9px] font-black uppercase tracking-widest text-gray-500">
                Elastic Modulus (E)
              </label>
              <select
                value={units.elasticModulus}
                onChange={(e) =>
                  setUnits((prev) => ({
                    ...prev,
                    elasticModulus: e.target.value as ElasticModulusUnit,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-xs font-bold uppercase outline-none"
              >
                {(
                  ["kN/m^2", "MPa", "GPa", "psi", "ksi"] as ElasticModulusUnit[]
                ).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 ml-1 block text-[9px] font-black uppercase tracking-widest text-gray-500">
                Inertia (I)
              </label>
              <select
                value={units.inertia}
                onChange={(e) =>
                  setUnits((prev) => ({
                    ...prev,
                    inertia: e.target.value as InertiaUnit,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-xs font-bold uppercase outline-none"
              >
                {(["m^4", "cm^4", "mm^4", "ft^4", "in^4"] as InertiaUnit[]).map(
                  (u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={save}
              className="rounded-xl bg-[var(--primary)] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-[var(--primary-glow)] hover:opacity-90"
            >
              Save Settings
            </button>
            <button
              onClick={reset}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:bg-white/10"
            >
              Reset To System Defaults
            </button>
            {savedAt && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Saved at {savedAt}
              </span>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
