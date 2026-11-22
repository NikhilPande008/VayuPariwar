import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/aqi/route";
import { aqiCache } from "@/lib/aqi/cache";
import { fetchWaqiStation, fetchWithTimeout } from "@/lib/aqi/clients";
import { aqiRateLimiter, IpRateLimiter } from "@/lib/validation/rateLimit";

function makeOpenMeteoPayload() {
  const times = Array.from(
    { length: 24 },
    (_, h) => `2026-11-22T${String(h).padStart(2, "0")}:00`
  );
  const pm25 = [
    180, 175, 170, 165, 190, 220, 240, 230, 190, 150, 125, 105, 92, 85, 78, 80,
    88, 110, 140, 165, 185, 195, 200, 190,
  ];
  const pm10 = pm25.map((v) => v * 1.4);

  return {
    current: {
      time: "2026-11-22T12:00",
      pm2_5: 145,
      pm10: 210,
      nitrogen_dioxide: 42,
      ozone: 35,
      carbon_monoxide: 1500, // 1500 ug/m3 -> 1.5 mg/m3
    },
    hourly: {
      time: times,
      pm2_5: pm25,
      pm10,
    },
  };
}

function makeFreshWaqiPayload() {
  return {
    status: "ok",
    data: {
      city: { name: "Anand Vihar, Delhi, India (CPCB)" },
      time: { iso: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
      iaqi: {
        pm25: { v: 260 },
        pm10: { v: 180 },
        no2: { v: 55 },
      },
    },
  };
}

describe("GET /api/aqi — Live Data Layer & Resilience", () => {
  const originalToken = process.env.WAQI_TOKEN;

  beforeEach(() => {
    aqiCache.clear();
    aqiRateLimiter.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.WAQI_TOKEN = originalToken;
    vi.unstubAllGlobals();
  });

  it("returns 400 when neither city nor lat/lon are provided, or coordinates are out of range", async () => {
    const res1 = await GET(new NextRequest("http://localhost:3000/api/aqi"));
    expect(res1.status).toBe(400);

    const res2 = await GET(
      new NextRequest("http://localhost:3000/api/aqi?lat=120&lon=77.2")
    );
    expect(res2.status).toBe(400);

    const res3 = await GET(
      new NextRequest("http://localhost:3000/api/aqi?lat=28.6&lon=-200")
    );
    expect(res3.status).toBe(400);
  });

  it("enforces AbortController timeout on slow external fetches", async () => {
    const slowFetch = vi.fn(
      (_url: string | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("Aborted");
            err.name = "AbortError";
            reject(err);
          });
        })
    );
    vi.stubGlobal("fetch", slowFetch);

    await expect(
      fetchWithTimeout("https://example.com/slow", 25)
    ).rejects.toThrow("Aborted");

    const waqiRes = await fetchWaqiStation(
      28.6,
      77.2,
      "valid-token",
      Date.now(),
      25
    );
    expect(waqiRes).toBeNull();
  });

  it("uses primary WAQI CPCB station when fresh and caches for 15 min", async () => {
    process.env.WAQI_TOKEN = "test-waqi-token";

    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("api.waqi.info")) {
        return new Response(JSON.stringify(makeFreshWaqiPayload()), {
          status: 200,
        });
      }
      return new Response(JSON.stringify(makeOpenMeteoPayload()), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res1 = await GET(
      new NextRequest("http://localhost:3000/api/aqi?city=delhi")
    );
    expect(res1.status).toBe(200);
    expect(res1.headers.get("X-Cache")).toBe("MISS");

    const data1 = await res1.json();
    expect(data1.sourceType).toBe("cpcb_waqi");
    expect(data1.stationName).toBe("Anand Vihar, Delhi, India (CPCB)");
    expect(data1.naqi.aqi).toBeGreaterThan(300);
    expect(data1.safeWindow.bestWindow.startHour).toBe(13);
    expect(data1.pollutants.co).toBe(1.5); // Converted from 1500 ug/m3
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const res2 = await GET(
      new NextRequest("http://localhost:3000/api/aqi?city=delhi")
    );
    expect(res2.status).toBe(200);
    expect(res2.headers.get("X-Cache")).toBe("HIT");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back truthfully to Open-Meteo on WAQI HTTP 429, 500, empty pollutants, or stale timestamp (>3h)", async () => {
    process.env.WAQI_TOKEN = "test-waqi-token";

    const scenarios: { name: string; city: string; waqiResponse: () => Response }[] = [
      {
        name: "HTTP 429",
        city: "pune",
        waqiResponse: () => new Response("Too Many Requests", { status: 429 }),
      },
      {
        name: "HTTP 500",
        city: "mumbai",
        waqiResponse: () => new Response("Server Error", { status: 500 }),
      },
      {
        name: "Empty pollutants",
        city: "kolkata",
        waqiResponse: () =>
          new Response(
            JSON.stringify({
              status: "ok",
              data: {
                city: { name: "Empty Station" },
                time: { iso: new Date().toISOString() },
                iaqi: {},
              },
            }),
            { status: 200 }
          ),
      },
      {
        name: "Stale >3h",
        city: "lucknow",
        waqiResponse: () =>
          new Response(
            JSON.stringify({
              status: "ok",
              data: {
                city: { name: "Stale Station" },
                time: {
                  iso: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
                },
                iaqi: { pm25: { v: 150 } },
              },
            }),
            { status: 200 }
          ),
      },
    ];

    for (const scenario of scenarios) {
      const fetchMock = vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.includes("api.waqi.info")) {
          return scenario.waqiResponse();
        }
        return new Response(JSON.stringify(makeOpenMeteoPayload()), {
          status: 200,
        });
      });
      vi.stubGlobal("fetch", fetchMock);

      const res = await GET(
        new NextRequest(`http://localhost:3000/api/aqi?city=${scenario.city}`)
      );
      expect(res.status, scenario.name).toBe(200);
      const data = await res.json();
      expect(data.sourceType, scenario.name).toBe("fallback_model");
      expect(data.sourceLabel, scenario.name).toBe("Fallback: Open-Meteo Model");
      expect(data.pollutants.co, scenario.name).toBe(1.5);
    }
  });

  it("returns HTTP 503 with structured error when BOTH primary and fallback fail (zero fake AQI)", async () => {
    process.env.WAQI_TOKEN = "test-waqi-token";

    const fetchMock = vi.fn(async () => {
      throw new Error("Network unreachable");
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(
      new NextRequest("http://localhost:3000/api/aqi?city=bengaluru")
    );
    expect(res.status).toBe(503);

    const data = await res.json();
    expect(data.code).toBe("AQI_SOURCES_UNAVAILABLE");
    expect(data.naqi).toBeUndefined();
  });

  it("bounds IpRateLimiter memory growth and enforces 429 on /api/aqi abuse", async () => {
    const bounded = new IpRateLimiter(5, 60_000, 3);
    bounded.check("10.0.0.1", 1000);
    bounded.check("10.0.0.2", 1000);
    bounded.check("10.0.0.3", 1000);
    bounded.check("10.0.0.4", 1000);
    expect(bounded.size()).toBeLessThanOrEqual(3);

    const ip = "203.0.113.55";
    for (let i = 0; i < 60; i += 1) {
      aqiRateLimiter.check(ip);
    }
    const res429 = await GET(
      new NextRequest("http://localhost:3000/api/aqi?city=delhi", {
        headers: { "x-forwarded-for": ip },
      })
    );
    expect(res429.status).toBe(429);
    expect(res429.headers.get("Retry-After")).toBeTruthy();
  });
});
