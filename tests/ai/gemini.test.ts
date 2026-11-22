import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateContentMock = vi.fn();

vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();
  return {
    ...actual,
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: generateContentMock,
      },
    })),
  };
});

import {
  classifyGeminiError,
  GeminiApiError,
  GeminiConfigError,
  generateCopilotReply,
  generateFamilyPlan,
  generateWhatsAppBriefing,
  parseJsonSafely,
  withTimeout,
} from "@/lib/ai/gemini";

const BASE_CONTEXT = {
  city: "Delhi",
  stationName: "Anand Vihar, Delhi (CPCB)",
  measuredAt: "2026-11-22T12:00:00.000Z",
  sourceType: "cpcb_waqi" as const,
  aqi: 340,
  category: "Very Poor" as const,
  primaryPollutant: "pm25" as const,
  pm25: 175,
  bestWindow: {
    startHour: 14,
    endHour: 17,
    label: "2:00 PM - 5:00 PM",
    avgPm25: 82,
  },
  peakWindow: {
    startHour: 6,
    endHour: 9,
    label: "6:00 AM - 9:00 AM",
    avgPm25: 240,
  },
  reductionPercent: 66,
};

const BASE_PROFILE = {
  members: ["commuter" as const],
  commuteMode: "solo_car" as const,
  hasHepaPurifier: false,
  kitchenSetup: "gas_no_chimney" as const,
  flatExposure: "roadside_low" as const,
};

describe("gemini.ts — Error Classification, Timeouts, Parsing & SDK Orchestration", () => {
  const originalKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    generateContentMock.mockReset();
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalKey;
  });

  it("throws GeminiConfigError (503) when GEMINI_API_KEY is missing or placeholder", async () => {
    process.env.GEMINI_API_KEY = "your_gemini_api_key_here";
    await expect(
      generateCopilotReply({
        message: "Is 5 PM safe?",
        mode: "copilot",
        aqiContext: BASE_CONTEXT,
        profile: BASE_PROFILE,
      })
    ).rejects.toBeInstanceOf(GeminiConfigError);
  });

  it("classifies 429 rate limits, timeouts, and generic failures accurately", () => {
    const rateLimited = classifyGeminiError({ status: 429, message: "Quota" });
    expect(rateLimited.code).toBe("AI_RATE_LIMITED");
    expect(rateLimited.status).toBe(429);

    const abortErr = new Error("Request timed out");
    abortErr.name = "AbortError";
    const timeout = classifyGeminiError(abortErr);
    expect(timeout.code).toBe("AI_TIMEOUT");
    expect(timeout.status).toBe(504);

    const generic = classifyGeminiError(new Error("Upstream 500"));
    expect(generic.code).toBe("AI_GENERATION_FAILED");
    expect(generic.status).toBe(502);
  });

  it("rejects slow promises with AI_TIMEOUT (504) via withTimeout", async () => {
    const neverResolving = new Promise<string>(() => {});
    await expect(withTimeout(neverResolving, 15)).rejects.toMatchObject({
      code: "AI_TIMEOUT",
      status: 504,
    });
  });

  it("validates JSON via parseJsonSafely and rejects empty or malformed payloads", () => {
    expect(parseJsonSafely('{"ok":true}', "test")).toEqual({ ok: true });
    expect(() => parseJsonSafely("", "test")).toThrow(GeminiApiError);
    expect(() => parseJsonSafely("{broken", "test")).toThrow(GeminiApiError);
  });

  it("generates and schema-validates Family Plan, WhatsApp Briefing, and Copilot replies", async () => {
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({
        headline: "Use 2-5 PM safe window today.",
        memberPlans: [
          {
            role: "Daily Commuter",
            morning: "Wear N95.",
            afternoon: "Safe window errands.",
            evening: "Keep windows closed.",
          },
        ],
        homeShieldHacks: [
          {
            title: "Wet Mopping",
            action: "Damp mop instead of dry sweeping.",
            costTier: "Zero-Cost",
            whyItWorks: "Avoids resuspending settled dust.",
          },
        ],
        impactSummary: "Timing and N95 reduce exposure.",
      }),
    });

    const plan = await generateFamilyPlan({
      aqiContext: BASE_CONTEXT,
      profile: BASE_PROFILE,
    });
    expect(plan.headline).toContain("2-5 PM");

    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({ message: "नमस्ते परिवार!" }),
    });
    const briefing = await generateWhatsAppBriefing({
      language: "hi",
      aqiContext: BASE_CONTEXT,
      profile: BASE_PROFILE,
    });
    expect(briefing.language).toBe("hi");
    expect(briefing.message).toBe("नमस्ते परिवार!");

    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({ reply: "Keep play inside before 2 PM." }),
    });
    const chat = await generateCopilotReply({
      message: "Is park play safe?",
      mode: "copilot",
      aqiContext: BASE_CONTEXT,
      profile: BASE_PROFILE,
    });
    expect(chat.reply).toContain("2 PM");
  });
});
