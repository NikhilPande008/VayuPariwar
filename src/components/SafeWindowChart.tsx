/**
 * 24-hour Safe-Window PM2.5 timeline chart highlighting the best 3-hour waking window
 * and peak inversion hours with WCAG AA color + icon + text summary cards.
 */
"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";
import type { HourlyAqiPoint, SafeWindowResult } from "@/types";
import { formatHourLabel } from "@/lib/engine/safeWindow";

interface SafeWindowChartProps {
  hourly: HourlyAqiPoint[];
  safeWindow: SafeWindowResult;
}

function isHourInWindow(hour: number, startHour: number): boolean {
  for (let offset = 0; offset < 3; offset += 1) {
    if ((startHour + offset) % 24 === hour) {
      return true;
    }
  }
  return false;
}

export function SafeWindowChart({ hourly, safeWindow }: SafeWindowChartProps) {
  const chartData = hourly.map((point) => {
    const isBest = isHourInWindow(point.hour, safeWindow.bestWindow.startHour);
    const isPeak = isHourInWindow(point.hour, safeWindow.peakWindow.startHour);
    return {
      hour: point.hour,
      shortLabel: `${String(point.hour).padStart(2, "0")}:00`,
      fullLabel: formatHourLabel(point.hour),
      pm25: point.pm25,
      zone: isBest ? "Best Window" : isPeak ? "Peak Smog" : "Standard",
      fill: isBest ? "#059669" : isPeak ? "#dc2626" : "#64748b",
    };
  });

  return (
    <section
      aria-labelledby="safe-window-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="safe-window-heading"
            className="text-base font-bold text-slate-900"
          >
            24-Hour Safe-Window Timeline (Hourly PM2.5)
          </h2>
          <p className="text-xs text-slate-600">
            Deterministic 3-hour rolling window scan across waking hours
            (6:00 AM - 9:00 PM).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-700">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-xs bg-emerald-600"
              aria-hidden="true"
            />
            Best Window
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-xs bg-red-600"
              aria-hidden="true"
            />
            Peak Smog
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-xs bg-slate-500"
              aria-hidden="true"
            />
            Other Hours
          </span>
        </div>
      </div>

      {/* Summary highlight cards (Icon + Color + Text for WCAG AA) */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Best Waking Window</span>
          </div>
          <p className="mt-1 text-sm font-bold text-emerald-950">
            {safeWindow.bestWindow.label}
          </p>
          <p className="text-xs text-emerald-900">
            Avg {safeWindow.bestWindow.avgPm25} µg/m³ PM2.5
          </p>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-red-900">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Peak Smog Warning</span>
          </div>
          <p className="mt-1 text-sm font-bold text-red-950">
            {safeWindow.peakWindow.label}
          </p>
          <p className="text-xs text-red-900">
            Avg {safeWindow.peakWindow.avgPm25} µg/m³ PM2.5
          </p>
        </div>

        <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-900">
            <TrendingDown className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Timing Advantage</span>
          </div>
          <p className="mt-1 text-sm font-bold text-teal-950">
            {safeWindow.reductionPercent}% Lower PM2.5
          </p>
          <p className="text-xs text-teal-900">
            Best window vs. peak smog hours
          </p>
        </div>
      </div>

      {/* Recharts 24-hour Bar Chart */}
      <div className="mt-5 h-60 w-full" role="img" aria-label={`24-hour PM2.5 bar chart. Best waking window is ${safeWindow.bestWindow.label} at ${safeWindow.bestWindow.avgPm25} micrograms per cubic meter. Peak smog is ${safeWindow.peakWindow.label} at ${safeWindow.peakWindow.avgPm25} micrograms per cubic meter.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="shortLabel"
              tick={{ fontSize: 11, fill: "#475569" }}
              interval={2}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#475569" }}
              unit=" µg"
            />
            <Tooltip
              formatter={(value: number) => [`${value} µg/m³`, "PM2.5"]}
              labelFormatter={(_, payload) => {
                const item = payload?.[0]?.payload as
                  | { fullLabel?: string; zone?: string }
                  | undefined;
                return item
                  ? `${item.fullLabel ?? ""} (${item.zone ?? ""})`
                  : "";
              }}
              contentStyle={{
                borderRadius: "10px",
                borderColor: "#cbd5e1",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="pm25" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={`bar-${entry.hour}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
