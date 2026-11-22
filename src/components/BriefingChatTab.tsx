/**
 * Tab 3 — Composes the WhatsApp Family Briefing generator and Family Air Copilot
 * with memoized live AQI + SmogShift grounding context.
 */
"use client";

import { useMemo } from "react";
import type {
  AqiApiResponse,
  HouseholdProfile,
  SmogShiftToggles,
} from "@/types";
import { calculateSmogShift } from "@/lib/engine/smogShift";
import { WhatsAppBriefingCard } from "@/components/WhatsAppBriefingCard";
import { FamilyCopilotCard } from "@/components/FamilyCopilotCard";

interface BriefingChatTabProps {
  aqiData: AqiApiResponse;
  profile: HouseholdProfile;
  toggles: SmogShiftToggles;
  commuteDistanceKm: number;
}

export function BriefingChatTab({
  aqiData,
  profile,
  toggles,
  commuteDistanceKm,
}: BriefingChatTabProps) {
  const currentPm25 =
    aqiData.pollutants.pm25 ?? aqiData.safeWindow.peakWindow.avgPm25;
  const safeWindowPm25 = aqiData.safeWindow.bestWindow.avgPm25;

  const sharedContext = useMemo(() => {
    const shift = calculateSmogShift(
      currentPm25,
      safeWindowPm25,
      toggles,
      commuteDistanceKm
    );

    return {
      aqiContext: {
        city: aqiData.city,
        stationName: aqiData.stationName,
        measuredAt: aqiData.measuredAt,
        sourceType: aqiData.sourceType,
        aqi: aqiData.naqi.aqi,
        category: aqiData.naqi.category,
        primaryPollutant: aqiData.naqi.primaryPollutant,
        pm25: aqiData.pollutants.pm25 ?? undefined,
        pm10: aqiData.pollutants.pm10 ?? undefined,
        bestWindow: aqiData.safeWindow.bestWindow,
        peakWindow: aqiData.safeWindow.peakWindow,
        reductionPercent: aqiData.safeWindow.reductionPercent,
      },
      profile,
      smogShift: {
        pm25ReductionPercent: shift.pm25ReductionPercent,
        co2AvoidedKgPerDay: shift.co2AvoidedKgPerDay,
        selectedCommute: toggles.selectedCommute,
        shiftToSafeWindow: toggles.shiftToSafeWindow,
        indoorHabits: toggles.indoorHabits,
        personalProtection: toggles.personalProtection,
      },
    };
  }, [aqiData, currentPm25, safeWindowPm25, profile, toggles, commuteDistanceKm]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <WhatsAppBriefingCard city={aqiData.city} sharedContext={sharedContext} />
      <FamilyCopilotCard
        city={aqiData.city}
        aqi={aqiData.naqi.aqi}
        sharedContext={sharedContext}
      />
    </div>
  );
}
