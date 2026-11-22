import type { CommuteMode, SmogShiftResult, SmogShiftToggles } from "@/types";

/**
 * India-specific passenger transport emission factors (kg CO2 per passenger-km).
 * Sources: India GHG Program / MoEFCC urban transport benchmarks.
 */
export const INDIA_CO2_EMISSION_FACTORS: Record<CommuteMode, number> = {
  solo_car: 0.17,
  two_wheeler: 0.05,
  carpool: 0.06,
  metro_bus: 0.02,
  wfh: 0,
};

/**
 * Relative commute PM2.5 inhalation multiplier compared to open roadside exposure.
 */
const COMMUTE_EXPOSURE_MULTIPLIER: Record<CommuteMode, number> = {
  two_wheeler: 1.0,
  solo_car: 0.72,
  carpool: 0.72,
  metro_bus: 0.48,
  wfh: 0.0,
};

// Typical urban Indian family daily exposure share weights (sum = 1.0)
const OUTDOOR_ACTIVITY_WEIGHT = 0.35;
const COMMUTE_WEIGHT = 0.25;
const INDOOR_WEIGHT = 0.4;

// Protective efficacy factors
const N95_OUTDOOR_FILTRATION = 0.85; // 85% real-world N95 fit filtration outdoors
const DRAFT_SEALING_INDOOR_REDUCTION = 0.18; // 18% less outdoor smog infiltration
const INDOOR_HABITS_REDUCTION = 0.35; // Exhaust + lid-on cooking + skip incense/dhoop

/**
 * Pure deterministic SmogShift simulator.
 * Computes personal PM2.5 inhalation reduction (%) and daily CO2 avoided (kg/day)
 * based on live current/safe-window PM2.5, active toggles, and daily commute distance.
 */
export function calculateSmogShift(
  currentPm25: number,
  safeWindowPm25: number,
  activeToggles: SmogShiftToggles,
  commuteDistanceKm = 20
): SmogShiftResult {
  if (!Number.isFinite(currentPm25) || currentPm25 < 0) {
    throw new RangeError(`Invalid currentPm25: ${String(currentPm25)}`);
  }
  if (!Number.isFinite(safeWindowPm25) || safeWindowPm25 < 0) {
    throw new RangeError(`Invalid safeWindowPm25: ${String(safeWindowPm25)}`);
  }
  if (!Number.isFinite(commuteDistanceKm) || commuteDistanceKm < 0) {
    throw new RangeError(
      `Invalid commuteDistanceKm: ${String(commuteDistanceKm)}`
    );
  }

  // 1. Daily CO2 avoided (kg/day)
  const baselineFactor =
    INDIA_CO2_EMISSION_FACTORS[activeToggles.baselineCommute];
  const selectedFactor =
    INDIA_CO2_EMISSION_FACTORS[activeToggles.selectedCommute];
  const rawCo2Avoided = Math.max(
    0,
    (baselineFactor - selectedFactor) * commuteDistanceKm
  );
  const co2AvoidedKgPerDay = Math.round(rawCo2Avoided * 100) / 100;

  if (currentPm25 === 0) {
    return {
      pm25ReductionPercent: 0,
      co2AvoidedKgPerDay,
      estimatedBaselinePm25: 0,
      estimatedProtectedPm25: 0,
      breakdown: {
        outdoorTimingPct: 0,
        personalProtectionPct: 0,
        indoorHabitsPct: 0,
        commuteShiftPct: 0,
      },
    };
  }

  // 2. Baseline daily effective PM2.5 exposure index
  const baselineCommuteMult =
    COMMUTE_EXPOSURE_MULTIPLIER[activeToggles.baselineCommute];
  const selectedCommuteMult =
    COMMUTE_EXPOSURE_MULTIPLIER[activeToggles.selectedCommute];

  const baselineOutdoorDose = OUTDOOR_ACTIVITY_WEIGHT * currentPm25;
  const baselineCommuteDose =
    COMMUTE_WEIGHT * currentPm25 * baselineCommuteMult;
  const baselineIndoorDose = INDOOR_WEIGHT * currentPm25 * 0.65; // Typical indoor/outdoor ratio ~0.65
  const totalBaselineDose =
    baselineOutdoorDose + baselineCommuteDose + baselineIndoorDose;

  // 3. Apply toggles sequentially to track exact contribution per lever
  // Lever A: Outdoor timing shift (peak -> safe window)
  const effectiveOutdoorPm25 = activeToggles.shiftToSafeWindow
    ? Math.min(currentPm25, safeWindowPm25)
    : currentPm25;
  const outdoorAfterTiming = OUTDOOR_ACTIVITY_WEIGHT * effectiveOutdoorPm25;
  const outdoorTimingSaved = Math.max(
    0,
    baselineOutdoorDose - outdoorAfterTiming
  );

  // Lever B: Commute mode shift (only reduces if new mode has lower exposure)
  const effectiveCommuteMult = Math.min(
    baselineCommuteMult,
    selectedCommuteMult
  );
  const commuteAfterShift =
    COMMUTE_WEIGHT * currentPm25 * effectiveCommuteMult;
  const commuteShiftSaved = Math.max(
    0,
    baselineCommuteDose - commuteAfterShift
  );

  // Lever C: Personal protection (N95 outdoors + door draft sealing indoors)
  const outdoorFinal = activeToggles.personalProtection
    ? outdoorAfterTiming * (1 - N95_OUTDOOR_FILTRATION)
    : outdoorAfterTiming;
  const commuteFinal = activeToggles.personalProtection
    ? commuteAfterShift * (1 - N95_OUTDOOR_FILTRATION)
    : commuteAfterShift;
  const indoorAfterSealing = activeToggles.personalProtection
    ? baselineIndoorDose * (1 - DRAFT_SEALING_INDOOR_REDUCTION)
    : baselineIndoorDose;

  const personalProtectionSaved =
    outdoorAfterTiming -
    outdoorFinal +
    (commuteAfterShift - commuteFinal) +
    (baselineIndoorDose - indoorAfterSealing);

  // Lever D: Indoor habits (Exhaust + lid-on cooking + skip incense/dhoop)
  const indoorFinal = activeToggles.indoorHabits
    ? indoorAfterSealing * (1 - INDOOR_HABITS_REDUCTION)
    : indoorAfterSealing;
  const indoorHabitsSaved = indoorAfterSealing - indoorFinal;

  const totalFinalDose = outdoorFinal + commuteFinal + indoorFinal;
  const totalSaved = Math.max(0, totalBaselineDose - totalFinalDose);

  const pm25ReductionPercent = Math.max(
    0,
    Math.min(95, Math.round((totalSaved / totalBaselineDose) * 100))
  );

  const toPct = (saved: number): number =>
    Math.round((saved / totalBaselineDose) * 100);

  return {
    pm25ReductionPercent,
    co2AvoidedKgPerDay,
    estimatedBaselinePm25: Math.round(totalBaselineDose * 10) / 10,
    estimatedProtectedPm25: Math.round(totalFinalDose * 10) / 10,
    breakdown: {
      outdoorTimingPct: toPct(outdoorTimingSaved),
      personalProtectionPct: toPct(personalProtectionSaved),
      indoorHabitsPct: toPct(indoorHabitsSaved),
      commuteShiftPct: toPct(commuteShiftSaved),
    },
  };
}
