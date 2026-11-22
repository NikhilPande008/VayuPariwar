import { describe, expect, it } from "vitest";
import {
  calculateNaqi,
  calculateNaqiSafe,
  calculateSubIndex,
  convertCoUgToMg,
  formatPollutantName,
  getNaqiCategory,
  NaqiCalculationError,
} from "@/lib/engine/naqi";

describe("naqi — Indian CPCB National AQI Calculator", () => {
  describe("getNaqiCategory", () => {
    it("maps official CPCB category boundaries accurately", () => {
      expect(getNaqiCategory(0)).toBe("Good");
      expect(getNaqiCategory(50)).toBe("Good");
      expect(getNaqiCategory(51)).toBe("Satisfactory");
      expect(getNaqiCategory(100)).toBe("Satisfactory");
      expect(getNaqiCategory(101)).toBe("Moderate");
      expect(getNaqiCategory(200)).toBe("Moderate");
      expect(getNaqiCategory(201)).toBe("Poor");
      expect(getNaqiCategory(300)).toBe("Poor");
      expect(getNaqiCategory(301)).toBe("Very Poor");
      expect(getNaqiCategory(400)).toBe("Very Poor");
      expect(getNaqiCategory(401)).toBe("Severe");
      expect(getNaqiCategory(500)).toBe("Severe");
    });
  });

  describe("calculateSubIndex & continuous breakpoints", () => {
    it("calculates exact CPCB breakpoints for PM2.5", () => {
      expect(calculateSubIndex("pm25", 0)).toBe(0);
      expect(calculateSubIndex("pm25", 30)).toBe(50);
      expect(calculateSubIndex("pm25", 60)).toBe(100);
      expect(calculateSubIndex("pm25", 90)).toBe(200);
      expect(calculateSubIndex("pm25", 120)).toBe(300);
      expect(calculateSubIndex("pm25", 250)).toBe(400);
      expect(calculateSubIndex("pm25", 380)).toBe(500);
    });

    it("handles continuous decimal readings cleanly with zero gaps or NaN", () => {
      const s1 = calculateSubIndex("pm25", 30.5);
      const s2 = calculateSubIndex("pm25", 60.2);
      const s3 = calculateSubIndex("pm25", 120.8);

      expect(Number.isNaN(s1)).toBe(false);
      expect(Number.isNaN(s2)).toBe(false);
      expect(Number.isNaN(s3)).toBe(false);
      expect(s1).toBeGreaterThanOrEqual(51);
      expect(s1).toBeLessThanOrEqual(55);
      expect(s2).toBeGreaterThanOrEqual(101);
      expect(s2).toBeLessThanOrEqual(105);
      expect(s3).toBeGreaterThanOrEqual(301);
      expect(s3).toBeLessThanOrEqual(305);
    });

    it("handles extreme winter smog (350 and 650 ug/m3) without overflow and caps at 500 Severe", () => {
      const severe350 = calculateNaqi({ pm25: 350 });
      expect(severe350.aqi).toBeGreaterThan(400);
      expect(severe350.aqi).toBeLessThanOrEqual(500);
      expect(severe350.category).toBe("Severe");

      const extreme650 = calculateNaqi({ pm25: 650 });
      expect(extreme650.aqi).toBe(500);
      expect(extreme650.category).toBe("Severe");
    });

    it("interpolates intermediate values linearly for PM10, NO2, O3, and CO", () => {
      expect(calculateSubIndex("pm10", 175)).toBe(151);
      expect(calculateSubIndex("no2", 60)).toBe(76);
      expect(calculateSubIndex("o3", 100)).toBe(100);
      expect(calculateSubIndex("co", 1.5)).toBe(76);
    });

    it("throws RangeError on negative or NaN concentration", () => {
      expect(() => calculateSubIndex("pm25", -5)).toThrow(RangeError);
      expect(() => calculateSubIndex("pm10", Number.NaN)).toThrow(RangeError);
      expect(() => calculateSubIndex("co", Number.POSITIVE_INFINITY)).toThrow(
        RangeError
      );
    });
  });

  describe("CO unit conversion (ug/m3 -> mg/m3)", () => {
    it("converts Open-Meteo CO ug/m3 to CPCB mg/m3 accurately", () => {
      expect(convertCoUgToMg(1500)).toBe(1.5);
      expect(convertCoUgToMg(2000)).toBe(2);
      expect(convertCoUgToMg(0)).toBe(0);
      expect(() => convertCoUgToMg(-100)).toThrow(RangeError);
    });
  });

  describe("calculateNaqi & calculateNaqiSafe", () => {
    it("selects highest sub-index, identifies primary pollutant, and marks dataCompleteness=complete when >=3 pollutants exist", () => {
      const result = calculateNaqi({
        pm25: 185,
        pm10: 210,
        no2: 45,
        o3: 32,
        co: 1.2,
      });

      expect(result.primaryPollutant).toBe("pm25");
      expect(result.aqi).toBe(351);
      expect(result.category).toBe("Very Poor");
      expect(result.dataCompleteness).toBe("complete");
    });

    it("flags dataCompleteness=partial when fewer than 3 valid pollutants are available", () => {
      const result = calculateNaqi({
        pm25: 55,
        pm10: 360,
      });

      expect(result.primaryPollutant).toBe("pm10");
      expect(result.category).toBe("Very Poor");
      expect(result.dataCompleteness).toBe("partial");
    });

    it("sanitizes flaky null, undefined, NaN, and negative sensor values", () => {
      const result = calculateNaqi({
        pm25: 30,
        pm10: null,
        no2: -10,
        o3: Number.NaN,
        co: undefined,
      });

      expect(result.aqi).toBe(50);
      expect(result.category).toBe("Good");
      expect(result.primaryPollutant).toBe("pm25");
      expect(result.dataCompleteness).toBe("partial");
    });

    it("returns a typed error state (never 0 / Good) when all pollutants are missing or invalid", () => {
      const outcome = calculateNaqiSafe({
        pm25: null,
        pm10: undefined,
        no2: -5,
        o3: Number.NaN,
      });

      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.error.code).toBe("NO_VALID_POLLUTANTS");
      }

      expect(() => calculateNaqi({})).toThrow(NaqiCalculationError);
    });
  });

  describe("formatPollutantName", () => {
    it("formats all supported pollutant keys cleanly", () => {
      expect(formatPollutantName("pm25")).toBe("PM2.5");
      expect(formatPollutantName("pm10")).toBe("PM10");
      expect(formatPollutantName("no2")).toBe("NO2");
      expect(formatPollutantName("o3")).toBe("O3");
      expect(formatPollutantName("co")).toBe("CO");
    });
  });
});
