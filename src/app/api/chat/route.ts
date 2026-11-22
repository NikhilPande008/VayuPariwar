/**
 * POST /api/chat — Handles sanitized, context-grounded Family Air Copilot Q&A and SmogShift explanations
 * with Zod validation (<=300 chars) and IP rate limiting.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  GeminiApiError,
  GeminiConfigError,
  generateCopilotReply,
} from "@/lib/ai/gemini";
import { aiRateLimiter, getClientIp } from "@/lib/validation/rateLimit";
import { chatRequestSchema } from "@/lib/validation/schemas";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientIp = getClientIp(request);
  const limit = aiRateLimiter.check(clientIp);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Please wait a minute before sending another question.",
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

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid chat request.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  try {
    const response = await generateCopilotReply(parsed.data);
    return NextResponse.json(response, { status: 200 });
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
        : "Failed to generate copilot response.";
    return NextResponse.json(
      { error: message, code: "AI_GENERATION_FAILED" },
      { status: 502 }
    );
  }
}
