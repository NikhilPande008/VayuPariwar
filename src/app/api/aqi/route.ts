/**
 * GET /api/aqi — Fetches live Indian CPCB/WAQI station readings and Open-Meteo hourly forecasts,
 * applies 15-minute coordinate-rounded TTL caching, and computes deterministic CPCB NAQI + Safe Window.
 */
import { NextRequest, NextResponse } from "next/server";
import type { AqiApiResponse } from "@/types";
import { aqiCache } from "@/lib/aqi/cache";
import { findCityByIdOrName, INDIAN_CITIES } from "@/lib/aqi/cities";
import {
  fetchOpenMeteoAirQuality,
  fetchWaqiStation,
} from "@/lib/aqi/clients";
import { calculateNaqiSafe } from "@/lib/engine/naqi";
import { detectSafeWindow } from "@/lib/engine/safeWindow";
import { aqiRateLimiter, getClientIp } from "@/lib/validation/rateLimit";
import { aqiQuerySchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const clientIp = getClientIp(request);
  const limit = aqiRateLimiter.check(clientIp);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "Too many AQI requests. Please retry shortly.",
        code: "RATE_LIMIT_EXCEEDED",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(limit.resetInMs / 1000)),
        },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = {
    city: searchParams.get("city") ?? undefined,
    lat: searchParams.get("lat") ?? undefined,
    lon: searchParams.get("lon") ?? undefined,
  };

  // Default to Delhi if no params are provided? No: validate strictly, or resolve known city.
  const parsed = aqiQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid query parameters.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  let lat = parsed.data.lat;
  let lon = parsed.data.lon;
  let cityName = parsed.data.city ?? "Current Location";

  if (parsed.data.city) {
    const matched = findCityByIdOrName(parsed.data.city);
    if (matched) {
      cityName = matched.name;
      if (lat === undefined || lon === undefined) {
        lat = matched.lat;
        lon = matched.lon;
      }
    } else if (lat === undefined || lon === undefined) {
      return NextResponse.json(
        {
          error: `Unknown city "${parsed.data.city}". Provide lat & lon coordinates or select one of: ${INDIAN_CITIES.map((c) => c.name).join(", ")}.`,
        },
        { status: 400 }
      );
    }
  }

  if (lat === undefined || lon === undefined) {
    return NextResponse.json(
      { error: "Both lat and lon coordinates are required." },
      { status: 400 }
    );
  }

  // Round coordinates to 2 decimal places for 15-minute cache key
  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = aqiCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      status: 200,
      headers: { "X-Cache": "HIT" },
    });
  }

  try {
    const [waqiResult, openMeteoResult] = await Promise.allSettled([
      fetchWaqiStation(lat, lon, process.env.WAQI_TOKEN),
      fetchOpenMeteoAirQuality(lat, lon),
    ]);

    const waqi =
      waqiResult.status === "fulfilled" ? waqiResult.value : null;
    const openMeteo =
      openMeteoResult.status === "fulfilled" ? openMeteoResult.value : null;

    if (!openMeteo && !waqi) {
      return NextResponse.json(
        {
          error:
            "Unable to fetch live air quality readings from CPCB/WAQI or Open-Meteo. Please retry shortly.",
          code: "AQI_SOURCES_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    // If Open-Meteo hourly forecast failed but WAQI succeeded, synthesize minimal 3-hour window?
    // No — truthful UI requires real hourly forecast; if Open-Meteo failed, fail truthfully with 503.
    if (!openMeteo) {
      return NextResponse.json(
        {
          error:
            "Hourly forecast service (Open-Meteo) is temporarily unavailable. Please retry.",
          code: "FORECAST_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    const usePrimary = waqi !== null;
    const pollutants = usePrimary
      ? {
          ...openMeteo.currentPollutants,
          ...waqi.pollutants,
        }
      : openMeteo.currentPollutants;

    const naqiOutcome = calculateNaqiSafe(pollutants);
    if (!naqiOutcome.ok) {
      return NextResponse.json(
        {
          error: naqiOutcome.error.message,
          code: naqiOutcome.error.code,
        },
        { status: 503 }
      );
    }

    const naqi = naqiOutcome.result;
    const safeWindow = detectSafeWindow(openMeteo.hourly);

    const payload: AqiApiResponse = {
      city: cityName,
      lat: Math.round(lat * 10000) / 10000,
      lon: Math.round(lon * 10000) / 10000,
      stationName: usePrimary
        ? waqi.stationName
        : `${cityName} (Open-Meteo Air Quality Model)`,
      measuredAt: usePrimary ? waqi.measuredAt : openMeteo.measuredAt,
      sourceType: usePrimary ? "cpcb_waqi" : "fallback_model",
      sourceLabel: usePrimary
        ? "Live CPCB / WAQI Station"
        : "Fallback: Open-Meteo Model",
      pollutants,
      naqi,
      hourly: openMeteo.hourly,
      safeWindow,
    };

    aqiCache.set(cacheKey, payload);

    return NextResponse.json(payload, {
      status: 200,
      headers: { "X-Cache": "MISS" },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected error fetching AQI data.";
    return NextResponse.json(
      { error: message, code: "AQI_INTERNAL_ERROR" },
      { status: 503 }
    );
  }
}
