/**
 * Secondary / 24-hour hourly forecast client for the Open-Meteo Air Quality API.
 */
import { z } from "zod";
import type { HourlyAqiPoint, PollutantReadings } from "@/types";
import { convertCoUgToMg } from "@/lib/engine/naqi";
import {
  EXTERNAL_FETCH_TIMEOUT_MS,
  fetchWithTimeout,
} from "@/lib/aqi/fetchWithTimeout";

const openMeteoResponseSchema = z.object({
  current: z.object({
    time: z.string(),
    pm2_5: z.number().nullable().optional(),
    pm10: z.number().nullable().optional(),
    nitrogen_dioxide: z.number().nullable().optional(),
    ozone: z.number().nullable().optional(),
    carbon_monoxide: z.number().nullable().optional(),
  }),
  hourly: z.object({
    time: z.array(z.string()).min(1),
    pm2_5: z.array(z.number().nullable()).min(1),
    pm10: z.array(z.number().nullable()).optional(),
  }),
});

export interface OpenMeteoReading {
  measuredAt: string;
  currentPollutants: PollutantReadings;
  hourly: HourlyAqiPoint[];
}

/**
 * Secondary / Forecast source: Open-Meteo Air Quality API (free, no key).
 * Enforces 5-second AbortController timeout and converts CO from ug/m3 to mg/m3.
 */
export async function fetchOpenMeteoAirQuality(
  lat: number,
  lon: number,
  timeoutMs = EXTERNAL_FETCH_TIMEOUT_MS
): Promise<OpenMeteoReading> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly: "pm2_5,pm10",
    current: "pm2_5,pm10,nitrogen_dioxide,ozone,carbon_monoxide",
    timezone: "Asia/Kolkata",
    forecast_days: "1",
  });

  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?${params.toString()}`;
  const response = await fetchWithTimeout(url, timeoutMs);

  if (!response.ok) {
    throw new Error(`Open-Meteo responded with HTTP ${response.status}`);
  }

  const rawJson: unknown = await response.json();
  const parsed = openMeteoResponseSchema.safeParse(rawJson);
  if (!parsed.success) {
    throw new Error("Open-Meteo returned an unexpected payload schema.");
  }

  const { current, hourly } = parsed.data;

  const currentPollutants: PollutantReadings = {};
  if (
    typeof current.pm2_5 === "number" &&
    Number.isFinite(current.pm2_5) &&
    current.pm2_5 >= 0
  ) {
    currentPollutants.pm25 = Math.round(current.pm2_5 * 10) / 10;
  }
  if (
    typeof current.pm10 === "number" &&
    Number.isFinite(current.pm10) &&
    current.pm10 >= 0
  ) {
    currentPollutants.pm10 = Math.round(current.pm10 * 10) / 10;
  }
  if (
    typeof current.nitrogen_dioxide === "number" &&
    Number.isFinite(current.nitrogen_dioxide) &&
    current.nitrogen_dioxide >= 0
  ) {
    currentPollutants.no2 = Math.round(current.nitrogen_dioxide * 10) / 10;
  }
  if (
    typeof current.ozone === "number" &&
    Number.isFinite(current.ozone) &&
    current.ozone >= 0
  ) {
    currentPollutants.o3 = Math.round(current.ozone * 10) / 10;
  }
  if (
    typeof current.carbon_monoxide === "number" &&
    Number.isFinite(current.carbon_monoxide) &&
    current.carbon_monoxide >= 0
  ) {
    // Open-Meteo reports CO in ug/m3; convert to mg/m3 for CPCB NAQI
    currentPollutants.co = convertCoUgToMg(current.carbon_monoxide);
  }

  const hourlyPoints: HourlyAqiPoint[] = [];
  for (let i = 0; i < Math.min(24, hourly.time.length); i += 1) {
    const timeStr = hourly.time[i];
    const pm25Val = hourly.pm2_5[i];
    if (
      !timeStr ||
      typeof pm25Val !== "number" ||
      !Number.isFinite(pm25Val) ||
      pm25Val < 0
    ) {
      continue;
    }
    const pm10Val = hourly.pm10?.[i];
    const hourMatch = /T(\d{2}):/.exec(timeStr);
    const hour = hourMatch?.[1] ? Number.parseInt(hourMatch[1], 10) : i % 24;

    hourlyPoints.push({
      time: timeStr,
      hour,
      pm25: Math.round(pm25Val * 10) / 10,
      ...(typeof pm10Val === "number" &&
      Number.isFinite(pm10Val) &&
      pm10Val >= 0
        ? { pm10: Math.round(pm10Val * 10) / 10 }
        : {}),
    });
  }

  if (hourlyPoints.length === 0) {
    throw new Error("Open-Meteo returned no valid hourly PM2.5 readings.");
  }

  const isoTime =
    current.time.includes("+") || current.time.endsWith("Z")
      ? current.time
      : `${current.time}:00+05:30`;

  return {
    measuredAt: new Date(isoTime).toISOString(),
    currentPollutants,
    hourly: hourlyPoints,
  };
}
