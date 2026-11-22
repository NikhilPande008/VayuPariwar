/**
 * Tab 2 — SmogShift interactive impact simulator combining synchronous client-side
 * deterministic calculations with an on-demand grounded Gemini impact explainer.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import type {
  AqiApiResponse,
  HouseholdProfile,
  SmogShiftToggles,
} from "@/types";
import { calculateSmogShift } from "@/lib/engine/smogShift";
import { SmogShiftMeters } from "@/components/SmogShiftMeters";
import { SmogShiftTogglesPanel } from "@/components/SmogShiftTogglesPanel";

interface SmogShiftTabProps {
  aqiData: AqiApiResponse;
  profile: HouseholdProfile;
  toggles: SmogShiftToggles;
  onTogglesChange: (next: SmogShiftToggles) => void;
  commuteDistanceKm: number;
  onDistanceChange: (km: number) => void;
}

export function SmogShiftTab({
  aqiData,
  profile,
  toggles,
  onTogglesChange,
  commuteDistanceKm,
  onDistanceChange,
}: SmogShiftTabProps) {
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const explainAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      explainAbortRef.current?.abort();
    };
  }, []);

  const currentPm25 =
    aqiData.pollutants.pm25 ?? aqiData.safeWindow.peakWindow.avgPm25;
  const safeWindowPm25 = aqiData.safeWindow.bestWindow.avgPm25;

  const result = useMemo(
    () =>
      calculateSmogShift(
        currentPm25,
        safeWindowPm25,
        toggles,
        commuteDistanceKm
      ),
    [currentPm25, safeWindowPm25, toggles, commuteDistanceKm]
  );

  const handleExplainImpact = async () => {
    explainAbortRef.current?.abort();
    const controller = new AbortController();
    explainAbortRef.current = controller;

    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          mode: "smogshift_explain",
          message:
            "Explain the direct health and environmental impact of my active SmogShift choices today.",
          aqiContext: {
            city: aqiData.city,
            stationName: aqiData.stationName,
            measuredAt: aqiData.measuredAt,
            sourceType: aqiData.sourceType,
            aqi: aqiData.naqi.aqi,
            category: aqiData.naqi.category,
            primaryPollutant: aqiData.naqi.primaryPollutant,
            pm25: aqiData.pollutants.pm25,
            pm10: aqiData.pollutants.pm10,
            bestWindow: aqiData.safeWindow.bestWindow,
            peakWindow: aqiData.safeWindow.peakWindow,
            reductionPercent: aqiData.safeWindow.reductionPercent,
          },
          profile,
          smogShift: {
            pm25ReductionPercent: result.pm25ReductionPercent,
            co2AvoidedKgPerDay: result.co2AvoidedKgPerDay,
            selectedCommute: toggles.selectedCommute,
            shiftToSafeWindow: toggles.shiftToSafeWindow,
            indoorHabits: toggles.indoorHabits,
            personalProtection: toggles.personalProtection,
          },
        }),
      });

      const data = (await response.json()) as { reply?: string; error?: string };
      if (controller.signal.aborted) return;
      if (!response.ok || !data.reply) {
        throw new Error(data.error ?? "Could not generate impact explanation.");
      }
      setAiExplanation(data.reply);
    } catch (err) {
      if (
        controller.signal.aborted ||
        (err instanceof Error && err.name === "AbortError")
      ) {
        return;
      }
      setAiError(
        err instanceof Error
          ? err.message
          : "Unable to load AI explanation right now."
      );
    } finally {
      if (!controller.signal.aborted) {
        setAiLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <SmogShiftMeters result={result} commuteDistanceKm={commuteDistanceKm} />

      <SmogShiftTogglesPanel
        bestWindowLabel={aqiData.safeWindow.bestWindow.label}
        toggles={toggles}
        onTogglesChange={onTogglesChange}
        commuteDistanceKm={commuteDistanceKm}
        onDistanceChange={onDistanceChange}
      />

      {/* GenAI "Why This Matters" Card */}
      <section
        aria-labelledby="why-matters-heading"
        className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-800" aria-hidden="true" />
            <h2
              id="why-matters-heading"
              className="text-sm font-bold text-slate-900"
            >
              Why This Matters Today (AI Explainer)
            </h2>
          </div>

          <button
            type="button"
            onClick={handleExplainImpact}
            disabled={aiLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-800 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 focus-visible:outline-none disabled:opacity-60"
          >
            {aiLoading ? (
              <RefreshCw
                className="h-3.5 w-3.5 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>
              {aiLoading ? "Explaining..." : "Explain Active Choices"}
            </span>
          </button>
        </div>

        <div aria-live="polite" className="mt-3">
          {aiError ? (
            <p role="alert" className="text-xs font-medium text-red-800">
              {aiError}
            </p>
          ) : aiExplanation ? (
            <p className="text-sm leading-relaxed text-slate-800">
              {aiExplanation}
            </p>
          ) : (
            <p className="text-xs text-slate-600">
              Toggle your commute, timing, indoor habits, or N95 protection
              above, then click <strong>Explain Active Choices</strong> for a
              plain-English health &amp; environmental breakdown grounded in{" "}
              {aqiData.city}&apos;s live NAQI ({aqiData.naqi.aqi}).
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
