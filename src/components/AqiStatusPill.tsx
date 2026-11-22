/**
 * Truthful live AQI status pill displaying CPCB NAQI severity (color + icon + text),
 * primary pollutant reading with matching unit, data source badge, and station timestamp.
 */
"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  OctagonAlert,
  RefreshCw,
  ShieldAlert,
  Smile,
} from "lucide-react";
import type { AqiApiResponse, NaqiCategory, PollutantKey } from "@/types";
import { formatPollutantName } from "@/lib/engine/naqi";
import { formatMeasuredTime, NAQI_SEVERITY_STYLES } from "@/lib/ui/severity";

interface AqiStatusPillProps {
  aqiData: AqiApiResponse | null;
  aqiLoading: boolean;
  aqiError: string | null;
  onRetryAqi: () => void;
}

function formatPrimaryPollutantReading(
  pollutant: PollutantKey,
  value: number | null | undefined
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return ` (${value} ${pollutant === "co" ? "mg/m³" : "µg/m³"})`;
}

function SeverityIcon({ category }: { category: NaqiCategory }) {
  const iconName = NAQI_SEVERITY_STYLES[category].iconName;
  const props = { className: "h-4 w-4 shrink-0", "aria-hidden": true as const };
  switch (iconName) {
    case "check":
      return <CheckCircle2 {...props} />;
    case "smile":
      return <Smile {...props} />;
    case "info":
      return <AlertCircle {...props} />;
    case "alert":
      return <AlertTriangle {...props} />;
    case "shield":
      return <ShieldAlert {...props} />;
    case "octagon":
      return <OctagonAlert {...props} />;
  }
}

export function AqiStatusPill({
  aqiData,
  aqiLoading,
  aqiError,
  onRetryAqi,
}: AqiStatusPillProps) {
  const severity = aqiData
    ? NAQI_SEVERITY_STYLES[aqiData.naqi.category]
    : null;

  return (
    <div className="flex flex-col items-start lg:items-end" aria-live="polite">
      {aqiLoading ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-600">
          <RefreshCw
            className="h-4 w-4 animate-spin text-teal-700"
            aria-hidden="true"
          />
          <span>Fetching live station readings...</span>
        </div>
      ) : aqiError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2 text-xs text-red-900"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Live AQI unavailable</span>
          <button
            type="button"
            onClick={onRetryAqi}
            className="rounded-md bg-red-800 px-2 py-1 text-xs font-semibold text-white hover:bg-red-900 focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-1 focus-visible:outline-none"
          >
            Retry
          </button>
        </div>
      ) : aqiData && severity ? (
        <div className="flex flex-col items-start gap-1 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${severity.badgeBg} ${severity.badgeText} ${severity.badgeBorder}`}
            >
              <SeverityIcon category={aqiData.naqi.category} />
              <span>NAQI {aqiData.naqi.aqi}</span>
              <span aria-hidden="true">&middot;</span>
              <span>{aqiData.naqi.category}</span>
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              Primary: {formatPollutantName(aqiData.naqi.primaryPollutant)}
              {formatPrimaryPollutantReading(
                aqiData.naqi.primaryPollutant,
                aqiData.pollutants[aqiData.naqi.primaryPollutant]
              )}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                aqiData.sourceType === "cpcb_waqi"
                  ? "border-teal-300 bg-teal-50 text-teal-900"
                  : "border-amber-300 bg-amber-50 text-amber-950"
              }`}
            >
              {aqiData.sourceLabel}
            </span>
          </div>
          <p className="text-xs text-slate-600">
            Station:{" "}
            <strong className="font-medium text-slate-800">
              {aqiData.stationName}
            </strong>{" "}
            &middot; Updated {formatMeasuredTime(aqiData.measuredAt)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
