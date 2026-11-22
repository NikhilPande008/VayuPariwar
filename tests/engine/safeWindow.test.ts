import { describe, expect, it } from "vitest";
import {
  detectSafeWindow,
  formatHourLabel,
  formatWindowRange,
} from "@/lib/engine/safeWindow";
import type { HourlyAqiPoint, HourlyAqiPointInput } from "@/types";

function make24HourProfile(pm25ByHour: number[]): HourlyAqiPoint[] {
  return pm25ByHour.map((pm25, hour) => ({
    time: `2026-11-22T${String(hour).padStart(2, "0")}:00:00+05:30`,
    hour,
    pm25,
  }));
}

describe("safeWindow — 3-Hour Sliding Safe-Window Detector", () => {
  it("formats 12-hour labels and ranges accurately", () => {
    expect(formatHourLabel(0)).toBe("12:00 AM");
    expect(formatHourLabel(7)).toBe("7:00 AM");
    expect(formatHourLabel(12)).toBe("12:00 PM");
    expect(formatHourLabel(15)).toBe("3:00 PM");
    expect(formatWindowRange(14, 17)).toBe("2:00 PM - 5:00 PM");
  });

  it("identifies lowest 3-hour waking window (06:00-21:00) and highest 24h peak inversion", () => {
    const hourly = make24HourProfile([
      190, 170, 60, 55, 60,
      240, 260, 250, 210, 170,
      140, 120, 105, 95, 80,
      85, 90, 110, 145, 175,
      200, 215, 220, 210,
    ]);

    const result = detectSafeWindow(hourly);

    expect(result.bestWindow.startHour).toBe(14);
    expect(result.bestWindow.endHour).toBe(17);
    expect(result.bestWindow.label).toBe("2:00 PM - 5:00 PM");
    expect(result.bestWindow.avgPm25).toBe(85);

    expect(result.peakWindow.startHour).toBe(5);
    expect(result.peakWindow.endHour).toBe(8);
    expect(result.peakWindow.avgPm25).toBe(250);
    expect(result.reductionPercent).toBe(66);
  });

  it("handles flat pollution curves where all hours have identical PM2.5 (zero or non-zero)", () => {
    const flatZero = detectSafeWindow(
      make24HourProfile(Array.from({ length: 24 }, () => 0))
    );
    expect(flatZero.bestWindow.avgPm25).toBe(0);
    expect(flatZero.reductionPercent).toBe(0);

    const flatHigh = detectSafeWindow(
      make24HourProfile(Array.from({ length: 24 }, () => 120))
    );
    expect(flatHigh.bestWindow.avgPm25).toBe(120);
    expect(flatHigh.peakWindow.avgPm25).toBe(120);
    expect(flatHigh.reductionPercent).toBe(0);
    expect(Number.isNaN(flatHigh.reductionPercent)).toBe(false);
  });

  it("handles incomplete hourly arrays (<24h and <3 waking hours) gracefully", () => {
    const nightSlice: HourlyAqiPoint[] = [
      { time: "2026-11-22T00:00:00", hour: 0, pm25: 120 },
      { time: "2026-11-22T01:00:00", hour: 1, pm25: 100 },
      { time: "2026-11-22T02:00:00", hour: 2, pm25: 80 },
      { time: "2026-11-22T03:00:00", hour: 3, pm25: 90 },
    ];
    const nightRes = detectSafeWindow(nightSlice);
    expect(nightRes.bestWindow.startHour).toBe(1);
    expect(nightRes.bestWindow.avgPm25).toBe(90);

    // Incomplete array with only 2 waking hours
    const twoHourSlice: HourlyAqiPoint[] = [
      { time: "2026-11-22T08:00:00", hour: 8, pm25: 110 },
      { time: "2026-11-22T09:00:00", hour: 9, pm25: 90 },
    ];
    const twoHourRes = detectSafeWindow(twoHourSlice);
    expect(twoHourRes.bestWindow.avgPm25).toBe(100);
    expect(twoHourRes.reductionPercent).toBe(0);
  });

  it("skips missing, null, NaN, and negative hourly slots without crashing", () => {
    const flakyHourly: HourlyAqiPointInput[] = [
      { time: "2026-11-22T07:00:00", hour: 7, pm25: null },
      { time: "2026-11-22T08:00:00", hour: 8, pm25: 180 },
      { time: "2026-11-22T09:00:00", hour: 9, pm25: undefined },
      { time: "2026-11-22T10:00:00", hour: 10, pm25: -5 },
      { time: "2026-11-22T11:00:00", hour: 11, pm25: 120 },
      { time: "2026-11-22T12:00:00", hour: 12, pm25: 90 },
      { time: "2026-11-22T13:00:00", hour: 13, pm25: 80 },
    ];

    const result = detectSafeWindow(flakyHourly);
    expect(result.bestWindow.avgPm25).toBe(96.7);
    expect(result.peakWindow.avgPm25).toBe(130);
  });

  it("throws when zero valid hourly PM2.5 readings remain", () => {
    expect(() => detectSafeWindow([])).toThrow();
    expect(() =>
      detectSafeWindow([
        { time: "2026-11-22T08:00:00", hour: 8, pm25: null },
        { time: "2026-11-22T09:00:00", hour: 9, pm25: -5 },
      ])
    ).toThrow();
  });
});
