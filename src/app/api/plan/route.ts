/**
 * POST /api/plan — Validates household & live AQI context, enforces IP rate limiting and 30-min caching,
 * and returns a schema-constrained Gemini 2.5 Flash Safe-Window Family Plan + Home Shield hacks.
 */
import { NextRequest, NextResponse } from "next/server";
import { planCache } from "@/lib/aqi/cache";
import {
  GeminiApiError,
  GeminiConfigError,
  generateFamilyPlan,
} from "@/lib/ai/gemini";
import { buildPlanCacheKey } from "@/lib/ai/prompts";
import { aiRateLimiter, getClientIp } from "@/lib/validation/rateLimit";
import { planRequestSchema } from "@/lib/validation/schemas";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientIp = getClientIp(request);
  const limit = aiRateLimiter.check(clientIp);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Please wait a minute before generating another plan.",
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const parsed = planRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request payload.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const cacheKey = buildPlanCacheKey(
    parsed.data.aqiContext,
    parsed.data.profile
  );
  const cached = planCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      status: 200,
      headers: { "X-Cache": "HIT" },
    });
  }

  try {
    const plan = await generateFamilyPlan(parsed.data);
    planCache.set(cacheKey, plan);
    return NextResponse.json(plan, {
      status: 200,
      headers: { "X-Cache": "MISS" },
    });
  } catch (err) {
    if (err instanceof GeminiConfigError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    if (err instanceof GeminiApiError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        {
          status: err.status,
          ...(err.status === 429 ? { headers: { "Retry-After": "30" } } : {}),
        }
      );
    }
    const message =
      err instanceof Error
        ? err.message
        : "Failed to generate personalized family plan.";
    return NextResponse.json(
      { error: message, code: "AI_GENERATION_FAILED" },
      { status: 502 }
    );
  }
}
