import { describe, expect, it } from "vitest";
import {
  calculateSmogShift,
  INDIA_CO2_EMISSION_FACTORS,
} from "@/lib/engine/smogShift";
import type { SmogShiftToggles } from "@/types";

const BASELINE_TOGGLES: SmogShiftToggles = {
  baselineCommute: "solo_car",
  selectedCommute: "solo_car",
  shiftToSafeWindow: false,
  indoorHabits: false,
  personalProtection: false,
};

describe("smogShift — Deterministic Impact Simulator", () => {
  it("returns 0% PM2.5 reduction and 0 kg CO2 avoided when all toggles are disabled", () => {
    const result = calculateSmogShift(200, 90, BASELINE_TOGGLES, 20);
    expect(result.pm25ReductionPercent).toBe(0);
    expect(result.co2AvoidedKgPerDay).toBe(0);
    expect(result.estimatedBaselinePm25).toBe(result.estimatedProtectedPm25);
  });

  it("handles zero-km commute (WFH) cleanly with 0 kg CO2 and zero NaN", () => {
    const result = calculateSmogShift(
      180,
      90,
      { ...BASELINE_TOGGLES, selectedCommute: "wfh" },
      0
    );
    expect(result.co2AvoidedKgPerDay).toBe(0);
    expect(Number.isNaN(result.pm25ReductionPercent)).toBe(false);
    expect(result.pm25ReductionPercent).toBeGreaterThan(0);
  });

  it("computes India-specific daily CO2 savings accurately for Solo Car -> Metro/Bus and WFH", () => {
    const toMetro = calculateSmogShift(
      200,
      90,
      { ...BASELINE_TOGGLES, selectedCommute: "metro_bus" },
      20
    );
    expect(toMetro.co2AvoidedKgPerDay).toBe(3);

    const toWfh = calculateSmogShift(
      200,
      90,
      { ...BASELINE_TOGGLES, selectedCommute: "wfh" },
      20
    );
    expect(toWfh.co2AvoidedKgPerDay).toBe(3.4);

    const twoWheelerToMetro = calculateSmogShift(
      200,
      90,
      {
        ...BASELINE_TOGGLES,
        baselineCommute: "two_wheeler",
        selectedCommute: "metro_bus",
      },
      20
    );
    expect(twoWheelerToMetro.co2AvoidedKgPerDay).toBe(0.6);
    expect(INDIA_CO2_EMISSION_FACTORS.solo_car).toBe(0.17);
  });

  it("caps combined PM2.5 reduction at <=95% and never goes negative even if safeWindowPm25 > currentPm25", () => {
    const maxProtected = calculateSmogShift(
      400,
      10,
      {
        baselineCommute: "two_wheeler",
        selectedCommute: "wfh",
        shiftToSafeWindow: true,
        indoorHabits: true,
        personalProtection: true,
      },
      30
    );
    expect(maxProtected.pm25ReductionPercent).toBeGreaterThan(0);
    expect(maxProtected.pm25ReductionPercent).toBeLessThanOrEqual(95);

    const invertedWindow = calculateSmogShift(
      80,
      150, // safeWindowPm25 higher than currentPm25
      { ...BASELINE_TOGGLES, shiftToSafeWindow: true },
      20
    );
    expect(invertedWindow.pm25ReductionPercent).toBeGreaterThanOrEqual(0);
  });

  it("increases PM2.5 reduction monotonically as each protective toggle is enabled", () => {
    const step0 = calculateSmogShift(220, 88, BASELINE_TOGGLES, 20);
    const step1 = calculateSmogShift(
      220,
      88,
      { ...BASELINE_TOGGLES, shiftToSafeWindow: true },
      20
    );
    const step2 = calculateSmogShift(
      220,
      88,
      { ...BASELINE_TOGGLES, shiftToSafeWindow: true, indoorHabits: true },
      20
    );
    const step3 = calculateSmogShift(
      220,
      88,
      {
        ...BASELINE_TOGGLES,
        shiftToSafeWindow: true,
        indoorHabits: true,
        personalProtection: true,
      },
      20
    );

    expect(step1.pm25ReductionPercent).toBeGreaterThan(
      step0.pm25ReductionPercent
    );
    expect(step2.pm25ReductionPercent).toBeGreaterThan(
      step1.pm25ReductionPercent
    );
    expect(step3.pm25ReductionPercent).toBeGreaterThan(
      step2.pm25ReductionPercent
    );
  });

  it("throws RangeError on negative inputs", () => {
    expect(() => calculateSmogShift(-10, 50, BASELINE_TOGGLES, 20)).toThrow(
      RangeError
    );
    expect(() => calculateSmogShift(100, -5, BASELINE_TOGGLES, 20)).toThrow(
      RangeError
    );
    expect(() => calculateSmogShift(100, 50, BASELINE_TOGGLES, -1)).toThrow(
      RangeError
    );
  });
});
