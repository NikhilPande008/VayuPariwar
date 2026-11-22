/**
 * Interactive one-tap daily choice toggles for the SmogShift simulator
 * (commute mode swap, safe-window timing, clean indoor habits, N95 + draft sealing).
 */
"use client";

import { Car, Clock, Flame, ShieldCheck } from "lucide-react";
import type {
  BaselineCommuteMode,
  CommuteMode,
  SmogShiftToggles,
} from "@/types";

const TARGET_COMMUTE_OPTIONS: { id: CommuteMode; label: string }[] = [
  { id: "solo_car", label: "Solo Car" },
  { id: "two_wheeler", label: "2-Wheeler" },
  { id: "carpool", label: "Carpool" },
  { id: "metro_bus", label: "Metro / Bus" },
  { id: "wfh", label: "Work From Home" },
];

const BASELINE_OPTIONS: { id: BaselineCommuteMode; label: string }[] = [
  { id: "solo_car", label: "Solo Car" },
  { id: "two_wheeler", label: "2-Wheeler" },
];

interface SmogShiftTogglesPanelProps {
  bestWindowLabel: string;
  toggles: SmogShiftToggles;
  onTogglesChange: (next: SmogShiftToggles) => void;
  commuteDistanceKm: number;
  onDistanceChange: (km: number) => void;
}

export function SmogShiftTogglesPanel({
  bestWindowLabel,
  toggles,
  onTogglesChange,
  commuteDistanceKm,
  onDistanceChange,
}: SmogShiftTogglesPanelProps) {
  return (
    <section
      aria-labelledby="smogshift-toggles-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
    >
      <h2
        id="smogshift-toggles-heading"
        className="text-base font-bold text-slate-900"
      >
        One-Tap Daily Choice Toggles
      </h2>
      <p className="mt-0.5 text-xs text-slate-600">
        Flip choices below to see instant deterministic exposure and emission
        changes.
      </p>

      <div className="mt-4 space-y-4">
        {/* Toggle 1: Commute Mode */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-teal-700" aria-hidden="true" />
              <span className="text-sm font-bold text-slate-900">
                1. Commute Mode Swap
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-600">Baseline:</span>
              {BASELINE_OPTIONS.map((base) => (
                <button
                  key={base.id}
                  type="button"
                  aria-pressed={toggles.baselineCommute === base.id}
                  onClick={() =>
                    onTogglesChange({ ...toggles, baselineCommute: base.id })
                  }
                  className={`rounded-md border px-2 py-0.5 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 focus-visible:outline-none ${
                    toggles.baselineCommute === base.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {base.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {TARGET_COMMUTE_OPTIONS.map((opt) => {
              const active = toggles.selectedCommute === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onTogglesChange({ ...toggles, selectedCommute: opt.id })
                  }
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 focus-visible:outline-none ${
                    active
                      ? "border-teal-700 bg-teal-700 text-white"
                      : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <label
              htmlFor="commute-distance"
              className="text-xs font-medium text-slate-700"
            >
              Round-trip distance: <strong>{commuteDistanceKm} km</strong>
            </label>
            <input
              id="commute-distance"
              type="range"
              min={5}
              max={50}
              step={5}
              value={commuteDistanceKm}
              onChange={(e) => onDistanceChange(Number(e.target.value))}
              className="h-1.5 w-36 rounded-lg accent-teal-700 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
          </div>
        </div>

        {/* Toggles 2, 3, 4 */}
        <div className="grid gap-3 md:grid-cols-3">
          <button
            type="button"
            aria-pressed={toggles.shiftToSafeWindow}
            onClick={() =>
              onTogglesChange({
                ...toggles,
                shiftToSafeWindow: !toggles.shiftToSafeWindow,
              })
            }
            className={`flex flex-col items-start rounded-xl border p-4 text-left transition focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 focus-visible:outline-none ${
              toggles.shiftToSafeWindow
                ? "border-teal-700 bg-teal-50 text-teal-950"
                : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <Clock className="h-4 w-4 text-teal-700" aria-hidden="true" />
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-teal-900 ring-1 ring-slate-200">
                {toggles.shiftToSafeWindow ? "ON" : "OFF"}
              </span>
            </div>
            <span className="mt-2 text-sm font-bold">
              2. Shift Outdoor Timing
            </span>
            <span className="mt-1 text-xs text-slate-600">
              Move walk/errands from peak smog to{" "}
              <strong>{bestWindowLabel}</strong>.
            </span>
          </button>

          <button
            type="button"
            aria-pressed={toggles.indoorHabits}
            onClick={() =>
              onTogglesChange({
                ...toggles,
                indoorHabits: !toggles.indoorHabits,
              })
            }
            className={`flex flex-col items-start rounded-xl border p-4 text-left transition focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 focus-visible:outline-none ${
              toggles.indoorHabits
                ? "border-teal-700 bg-teal-50 text-teal-950"
                : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <Flame className="h-4 w-4 text-teal-700" aria-hidden="true" />
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-teal-900 ring-1 ring-slate-200">
                {toggles.indoorHabits ? "ON" : "OFF"}
              </span>
            </div>
            <span className="mt-2 text-sm font-bold">
              3. Clean Indoor Habits
            </span>
            <span className="mt-1 text-xs text-slate-600">
              Exhaust + lid-on cooking + skip incense / dhoop today.
            </span>
          </button>

          <button
            type="button"
            aria-pressed={toggles.personalProtection}
            onClick={() =>
              onTogglesChange({
                ...toggles,
                personalProtection: !toggles.personalProtection,
              })
            }
            className={`flex flex-col items-start rounded-xl border p-4 text-left transition focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 focus-visible:outline-none ${
              toggles.personalProtection
                ? "border-teal-700 bg-teal-50 text-teal-950"
                : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <ShieldCheck
                className="h-4 w-4 text-teal-700"
                aria-hidden="true"
              />
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-teal-900 ring-1 ring-slate-200">
                {toggles.personalProtection ? "ON" : "OFF"}
              </span>
            </div>
            <span className="mt-2 text-sm font-bold">
              4. N95 + Draft Sealing
            </span>
            <span className="mt-1 text-xs text-slate-600">
              Wear fitted N95 outdoors &amp; seal door gaps during smog peaks.
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
