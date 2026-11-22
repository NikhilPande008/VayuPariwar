import type {
  DataCompleteness,
  NaqiCategory,
  NaqiOutcome,
  NaqiResult,
  PollutantKey,
  PollutantReadings,
} from "@/types";

interface Breakpoint {
  bLo: number;
  bHi: number;
  iLo: number;
  iHi: number;
}

/**
 * Official CPCB Indian National Air Quality Index (NAQI) continuous breakpoint tables.
 * Units:
 * - pm25: ug/m3 (24-hr avg)
 * - pm10: ug/m3 (24-hr avg)
 * - no2:  ug/m3 (24-hr avg)
 * - o3:   ug/m3 (8-hr avg)
 * - co:   mg/m3 (8-hr avg)
 */
const CPCB_BREAKPOINTS: Record<PollutantKey, readonly Breakpoint[]> = {
  pm25: [
    { bLo: 0, bHi: 30, iLo: 0, iHi: 50 },
    { bLo: 30, bHi: 60, iLo: 51, iHi: 100 },
    { bLo: 60, bHi: 90, iLo: 101, iHi: 200 },
    { bLo: 90, bHi: 120, iLo: 201, iHi: 300 },
    { bLo: 120, bHi: 250, iLo: 301, iHi: 400 },
    { bLo: 250, bHi: 380, iLo: 401, iHi: 500 },
  ],
  pm10: [
    { bLo: 0, bHi: 50, iLo: 0, iHi: 50 },
    { bLo: 50, bHi: 100, iLo: 51, iHi: 100 },
    { bLo: 100, bHi: 250, iLo: 101, iHi: 200 },
    { bLo: 250, bHi: 350, iLo: 201, iHi: 300 },
    { bLo: 350, bHi: 430, iLo: 301, iHi: 400 },
    { bLo: 430, bHi: 510, iLo: 401, iHi: 500 },
  ],
  no2: [
    { bLo: 0, bHi: 40, iLo: 0, iHi: 50 },
    { bLo: 40, bHi: 80, iLo: 51, iHi: 100 },
    { bLo: 80, bHi: 180, iLo: 101, iHi: 200 },
    { bLo: 180, bHi: 280, iLo: 201, iHi: 300 },
    { bLo: 280, bHi: 400, iLo: 301, iHi: 400 },
    { bLo: 400, bHi: 520, iLo: 401, iHi: 500 },
  ],
  o3: [
    { bLo: 0, bHi: 50, iLo: 0, iHi: 50 },
    { bLo: 50, bHi: 100, iLo: 51, iHi: 100 },
    { bLo: 100, bHi: 168, iLo: 101, iHi: 200 },
    { bLo: 168, bHi: 208, iLo: 201, iHi: 300 },
    { bLo: 208, bHi: 748, iLo: 301, iHi: 400 },
    { bLo: 748, bHi: 1000, iLo: 401, iHi: 500 },
  ],
  co: [
    { bLo: 0, bHi: 1.0, iLo: 0, iHi: 50 },
    { bLo: 1.0, bHi: 2.0, iLo: 51, iHi: 100 },
    { bLo: 2.0, bHi: 10.0, iLo: 101, iHi: 200 },
    { bLo: 10.0, bHi: 17.0, iLo: 201, iHi: 300 },
    { bLo: 17.0, bHi: 34.0, iLo: 301, iHi: 400 },
    { bLo: 34.0, bHi: 50.0, iLo: 401, iHi: 500 },
  ],
};

const POLLUTANT_ORDER: readonly PollutantKey[] = [
  "pm25",
  "pm10",
  "no2",
  "o3",
  "co",
];

export class NaqiCalculationError extends Error {
  readonly code = "NO_VALID_POLLUTANTS" as const;

  constructor(message: string) {
    super(message);
    this.name = "NaqiCalculationError";
  }
}

/**
 * Converts CO concentration from ug/m3 (e.g. Open-Meteo) to mg/m3 (CPCB NAQI unit).
 */
export function convertCoUgToMg(coUgM3: number): number {
  if (!Number.isFinite(coUgM3) || coUgM3 < 0) {
    throw new RangeError(`Invalid CO ug/m3 value: ${String(coUgM3)}`);
  }
  return Math.round((coUgM3 / 1000) * 1000) / 1000;
}

/**
 * Maps an Indian NAQI numeric score (0-500) to its official CPCB severity category.
 */
export function getNaqiCategory(aqi: number): NaqiCategory {
  const clamped = Math.max(0, Math.round(aqi));
  if (clamped <= 50) return "Good";
  if (clamped <= 100) return "Satisfactory";
  if (clamped <= 200) return "Moderate";
  if (clamped <= 300) return "Poor";
  if (clamped <= 400) return "Very Poor";
  return "Severe";
}

/**
 * Calculates the CPCB sub-index for a single pollutant concentration.
 * Handles continuous decimal readings without gaps and caps extreme Severe smog at 500.
 */
export function calculateSubIndex(
  pollutant: PollutantKey,
  concentration: number
): number {
  if (!Number.isFinite(concentration) || concentration < 0) {
    throw new RangeError(
      `Invalid concentration for ${pollutant}: ${String(concentration)}`
    );
  }

  const breakpoints = CPCB_BREAKPOINTS[pollutant];

  if (concentration === 0) {
    return 0;
  }

  for (const bp of breakpoints) {
    if (concentration <= bp.bHi) {
      const subIndex =
        ((bp.iHi - bp.iLo) / (bp.bHi - bp.bLo)) * (concentration - bp.bLo) +
        bp.iLo;
      return Math.min(500, Math.max(0, Math.round(subIndex)));
    }
  }

  // Open-ended Severe band beyond top breakpoint caps displayed NAQI at 500.
  return 500;
}

/**
 * Safe, non-throwing Indian NAQI calculation returning a typed outcome.
 * Sanitizes flaky sensor values (null, undefined, NaN, negative) and flags
 * dataCompleteness as "partial" when fewer than 3 valid pollutants are present.
 */
export function calculateNaqiSafe(readings: PollutantReadings): NaqiOutcome {
  const subIndices: Partial<Record<PollutantKey, number>> = {};
  let maxAqi = -1;
  let primaryPollutant: PollutantKey | null = null;
  let validPollutantCount = 0;

  for (const key of POLLUTANT_ORDER) {
    const value = readings[key];
    if (
      value === undefined ||
      value === null ||
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0
    ) {
      continue;
    }

    const sub = calculateSubIndex(key, value);
    subIndices[key] = sub;
    validPollutantCount += 1;

    if (sub > maxAqi) {
      maxAqi = sub;
      primaryPollutant = key;
    }
  }

  if (primaryPollutant === null || maxAqi < 0) {
    return {
      ok: false,
      error: {
        code: "NO_VALID_POLLUTANTS",
        message:
          "At least one valid non-negative pollutant reading is required to calculate NAQI.",
      },
    };
  }

  const dataCompleteness: DataCompleteness =
    validPollutantCount < 3 ? "partial" : "complete";

  return {
    ok: true,
    result: {
      aqi: Math.min(500, maxAqi),
      category: getNaqiCategory(maxAqi),
      primaryPollutant,
      subIndices,
      dataCompleteness,
    },
  };
}

/**
 * Calculates overall Indian National AQI (NAQI), throwing NaqiCalculationError
 * if no valid pollutant readings are available (never returns 0 / Good on missing data).
 */
export function calculateNaqi(readings: PollutantReadings): NaqiResult {
  const outcome = calculateNaqiSafe(readings);
  if (!outcome.ok) {
    throw new NaqiCalculationError(outcome.error.message);
  }
  return outcome.result;
}

/**
 * Human-readable display label for pollutant keys.
 */
export function formatPollutantName(pollutant: PollutantKey): string {
  switch (pollutant) {
    case "pm25":
      return "PM2.5";
    case "pm10":
      return "PM10";
    case "no2":
      return "NO2";
    case "o3":
      return "O3";
    case "co":
      return "CO";
  }
}
