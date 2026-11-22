/**
 * POST /api/briefing — Generates an English or Hindi (Devanagari) WhatsApp-ready family AQI briefing
 * with Zod validation and IP rate limiting.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  GeminiApiError,
  GeminiConfigError,
  generateWhatsAppBriefing,
} from "@/lib/ai/gemini";
import { aiRateLimiter, getClientIp } from "@/lib/validation/rateLimit";
import { briefingRequestSchema } from "@/lib/validation/schemas";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientIp = getClientIp(request);
  const limit = aiRateLimiter.check(clientIp);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Please wait a minute before generating another briefing.",
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

  const parsed = briefingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request payload.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  try {
    const briefing = await generateWhatsAppBriefing(parsed.data);
    return NextResponse.json(briefing, { status: 200 });
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
        : "Failed to generate WhatsApp family briefing.";
    return NextResponse.json(
      { error: message, code: "AI_GENERATION_FAILED" },
      { status: 502 }
    );
  }
}
