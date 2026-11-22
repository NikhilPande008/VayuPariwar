/**
 * Primary live ground-station client for WAQI (Indian CPCB stations).
 * Converts WAQI US-EPA PM2.5/PM10 sub-indices into ug/m3 mass concentrations.
 */
import { z } from "zod";
import type { PollutantReadings } from "@/types";
import {
  EXTERNAL_FETCH_TIMEOUT_MS,
  fetchWithTimeout,
} from "@/lib/aqi/fetchWithTimeout";

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

const waqiResponseSchema = z.object({
  status: z.string(),
  data: z
    .object({
      city: z
        .object({
          name: z.string().min(1),
        })
        .optional(),
      time: z
        .object({
          iso: z.string().optional(),
          s: z.string().optional(),
        })
        .optional(),
      iaqi: z
        .object({
          pm25: z.object({ v: z.number() }).optional(),
          pm10: z.object({ v: z.number() }).optional(),
          no2: z.object({ v: z.number() }).optional(),
          o3: z.object({ v: z.number() }).optional(),
          co: z.object({ v: z.number() }).optional(),
        })
        .optional(),
    })
    .optional(),
});

export interface WaqiStationReading {
  stationName: string;
  measuredAt: string;
  pollutants: PollutantReadings;
}

/**
 * Converts WAQI US-EPA PM2.5 sub-index to approximate ug/m3 concentration
 * so Indian CPCB NAQI breakpoints are computed on true mass concentration.
 */
export function usAqiToPm25UgM3(usAqi: number): number {
  const table: readonly [number, number, number, number][] = [
    [0, 50, 0, 12.0],
    [51, 100, 12.1, 35.4],
    [101, 150, 35.5, 55.4],
    [151, 200, 55.5, 150.4],
    [201, 300, 150.5, 250.4],
    [301, 400, 250.5, 350.4],
    [401, 500, 350.5, 500.4],
  ];

  const clamped = Math.max(0, Math.min(500, usAqi));
  for (const [iLo, iHi, cLo, cHi] of table) {
    if (clamped <= iHi) {
      const raw = ((clamped - iLo) / (iHi - iLo)) * (cHi - cLo) + cLo;
      return Math.round(raw * 10) / 10;
    }
  }
  return 500.4;
}

/**
 * Converts WAQI US-EPA PM10 sub-index to approximate ug/m3 concentration.
 */
export function usAqiToPm10UgM3(usAqi: number): number {
  const table: readonly [number, number, number, number][] = [
    [0, 50, 0, 54],
    [51, 100, 55, 154],
    [101, 150, 155, 254],
    [151, 200, 255, 354],
    [201, 300, 355, 424],
    [301, 400, 425, 504],
    [401, 500, 505, 604],
  ];

  const clamped = Math.max(0, Math.min(500, usAqi));
  for (const [iLo, iHi, cLo, cHi] of table) {
    if (clamped <= iHi) {
      const raw = ((clamped - iLo) / (iHi - iLo)) * (cHi - cLo) + cLo;
      return Math.round(raw * 10) / 10;
    }
  }
  return 604;
}

function isStaleTimestamp(isoTimestamp: string, nowMs = Date.now()): boolean {
  const parsed = Date.parse(isoTimestamp);
  if (Number.isNaN(parsed)) return true;
  return nowMs - parsed > THREE_HOURS_MS;
}

/**
 * Primary source: WAQI (CPCB ground monitoring station).
 * Returns null if token is missing, request times out (>5s), returns HTTP 429/5xx,
 * returns empty PM readings, or reading is stale (>3h).
 * Only PM2.5 and PM10 are extracted from WAQI (converted from US-EPA sub-indices to ug/m3);
 * gaseous pollutants (NO2, O3, CO) rely on Open-Meteo mass concentrations to avoid unit mixing.
 */
export async function fetchWaqiStation(
  lat: number,
  lon: number,
  token: string | undefined,
  nowMs = Date.now(),
  timeoutMs = EXTERNAL_FETCH_TIMEOUT_MS
): Promise<WaqiStationReading | null> {
  if (!token || token.trim().length === 0 || token === "your_waqi_token_here") {
    return null;
  }

  const url = `https://api.waqi.info/feed/geo:${lat.toFixed(4)};${lon.toFixed(4)}/?token=${encodeURIComponent(token)}`;

  try {
    const response = await fetchWithTimeout(url, timeoutMs);

    if (!response.ok) {
      return null;
    }

    const rawJson: unknown = await response.json();
    const parsed = waqiResponseSchema.safeParse(rawJson);
    if (!parsed.success || parsed.data.status !== "ok" || !parsed.data.data) {
      return null;
    }

    const { city, time, iaqi } = parsed.data.data;
    const measuredAt = time?.iso ?? time?.s;
    if (!measuredAt || isStaleTimestamp(measuredAt, nowMs)) {
      return null;
    }

    const pollutants: PollutantReadings = {};
    if (
      iaqi?.pm25?.v !== undefined &&
      Number.isFinite(iaqi.pm25.v) &&
      iaqi.pm25.v >= 0
    ) {
      pollutants.pm25 = usAqiToPm25UgM3(iaqi.pm25.v);
    }
    if (
      iaqi?.pm10?.v !== undefined &&
      Number.isFinite(iaqi.pm10.v) &&
      iaqi.pm10.v >= 0
    ) {
      pollutants.pm10 = usAqiToPm10UgM3(iaqi.pm10.v);
    }

    const hasAnyPollutant = Object.values(pollutants).some(
      (v) => typeof v === "number" && Number.isFinite(v) && v >= 0
    );
    if (!hasAnyPollutant) {
      return null;
    }

    return {
      stationName: city?.name ?? "CPCB Ground Station",
      measuredAt: new Date(measuredAt).toISOString(),
      pollutants,
    };
  } catch {
    return null;
  }
}
