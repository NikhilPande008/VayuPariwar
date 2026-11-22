/**
 * Deterministic SmogShift impact meters displaying personal PM2.5 inhalation reduction (%)
 * and India-specific daily community CO2 emissions avoided (kg/day).
 */
"use client";

import { Leaf, ShieldCheck } from "lucide-react";
import type { SmogShiftResult } from "@/types";

interface SmogShiftMetersProps {
  result: SmogShiftResult;
  commuteDistanceKm: number;
}

export function SmogShiftMeters({
  result,
  commuteDistanceKm,
}: SmogShiftMetersProps) {
  return (
    <section
      aria-labelledby="impact-meters-heading"
      className="grid gap-4 sm:grid-cols-2"
    >
      <h2 id="impact-meters-heading" className="sr-only">
        Instant Deterministic SmogShift Impact Meters
      </h2>

      {/* PM2.5 Reduction Meter */}
      <div className="rounded-2xl border border-teal-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-900 uppercase">
            <ShieldCheck className="h-4 w-4 text-teal-700" aria-hidden="true" />
            Personal PM2.5 Inhalation Reduced
          </span>
          <span className="text-xs font-medium text-slate-500">
            Deterministic
          </span>
        </div>

        <p
          data-testid="pm25-reduction-value"
          className="mt-2 text-3xl font-extrabold text-teal-900"
        >
          {result.pm25ReductionPercent}%
        </p>

        <div
          className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={result.pm25ReductionPercent}
          aria-valuemin={0}
          aria-valuemax={95}
          aria-label="Personal PM2.5 inhalation reduction percentage"
        >
          <div
            className="h-full rounded-full bg-teal-600 transition-all duration-300"
            style={{ width: `${Math.min(100, result.pm25ReductionPercent)}%` }}
          />
        </div>

        <p className="mt-2 text-xs text-slate-600">
          Effective daily exposure index:{" "}
          <strong className="text-slate-900">
            {result.estimatedProtectedPm25} µg/m³
          </strong>{" "}
          (down from {result.estimatedBaselinePm25} µg/m³)
        </p>
      </div>

      {/* CO2 Avoided Meter */}
      <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-900 uppercase">
            <Leaf className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            Community CO2 Avoided
          </span>
          <span className="text-xs font-medium text-slate-500">
            India GHG Factors
          </span>
        </div>

        <p
          data-testid="co2-avoided-value"
          className="mt-2 text-3xl font-extrabold text-emerald-900"
        >
          {result.co2AvoidedKgPerDay.toFixed(2)}{" "}
          <span className="text-base font-semibold text-emerald-800">
            kg / day
          </span>
        </p>

        <p className="mt-3 text-xs text-slate-600">
          ~{(result.co2AvoidedKgPerDay * 22).toFixed(1)} kg CO2 avoided per
          working month across a {commuteDistanceKm} km daily round-trip.
        </p>
      </div>
    </section>
  );
}
