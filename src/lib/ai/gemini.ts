/**
 * Server-side Gemini 2.5 Flash orchestration with strict JSON schemas, timeout handling, and typed error classification.
 */
import { GoogleGenAI } from "@google/genai";
import type {
  BriefingResponse,
  ChatResponse,
  FamilyPlanResponse,
} from "@/types";
import {
  familyPlanResponseSchema,
  type BriefingRequestInput,
  type ChatRequestInput,
  type PlanRequestInput,
} from "@/lib/validation/schemas";
import {
  BASE_SAFETY_SYSTEM_INSTRUCTION,
  buildBriefingUserPrompt,
  buildChatUserPrompt,
  buildPlanUserPrompt,
} from "@/lib/ai/prompts";
import {
  briefingGeminiSchema,
  chatGeminiSchema,
  familyPlanGeminiSchema,
} from "@/lib/ai/schemas";

export const GEMINI_MODEL =
  process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";
export const GEMINI_TIMEOUT_MS = 15_000;

export class GeminiConfigError extends Error {
  readonly code = "AI_NOT_CONFIGURED" as const;
  readonly status = 503;

  constructor(message: string) {
    super(message);
    this.name = "GeminiConfigError";
  }
}

export type GeminiApiErrorCode =
  | "AI_RATE_LIMITED"
  | "AI_TIMEOUT"
  | "AI_INVALID_RESPONSE"
  | "AI_GENERATION_FAILED";

export class GeminiApiError extends Error {
  readonly code: GeminiApiErrorCode;
  readonly status: number;

  constructor(code: GeminiApiErrorCode, status: number, message: string) {
    super(message);
    this.name = "GeminiApiError";
    this.code = code;
    this.status = status;
  }
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (
    !apiKey ||
    apiKey.trim().length === 0 ||
    apiKey === "your_gemini_api_key_here"
  ) {
    throw new GeminiConfigError(
      "GEMINI_API_KEY is not configured on the server."
    );
  }
  return new GoogleGenAI({ apiKey });
}

/** Classifies upstream Gemini SDK errors into typed HTTP status codes. */
export function classifyGeminiError(err: unknown): GeminiApiError {
  if (err instanceof GeminiApiError) {
    return err;
  }

  const message = err instanceof Error ? err.message : String(err);
  const statusProp =
    typeof err === "object" && err !== null && "status" in err
      ? Number((err as { status?: unknown }).status)
      : undefined;

  if (
    statusProp === 429 ||
    /\b429\b|resource_exhausted|quota|rate limit/i.test(message)
  ) {
    return new GeminiApiError(
      "AI_RATE_LIMITED",
      429,
      "Gemini AI is currently rate-limited. Live AQI and SmogShift meters remain available; please retry in a moment."
    );
  }

  if (
    err instanceof Error &&
    (err.name === "AbortError" || /timeout|timed out/i.test(message))
  ) {
    return new GeminiApiError(
      "AI_TIMEOUT",
      504,
      "Gemini AI request timed out. Live AQI and SmogShift meters remain available; please retry."
    );
  }

  return new GeminiApiError(
    "AI_GENERATION_FAILED",
    502,
    "AI service encountered a temporary error. Live AQI and SmogShift meters remain available."
  );
}

/** Races an async Gemini call against a bounded timeout. */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = GEMINI_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new GeminiApiError(
          "AI_TIMEOUT",
          504,
          "Gemini AI request timed out. Live AQI and SmogShift meters remain available; please retry."
        )
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/** Safely parses JSON returned by Gemini or throws AI_INVALID_RESPONSE. */
export function parseJsonSafely(
  text: string | undefined,
  label: string
): unknown {
  if (!text || text.trim().length === 0) {
    throw new GeminiApiError(
      "AI_INVALID_RESPONSE",
      502,
      `Gemini returned an empty response for ${label}.`
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiApiError(
      "AI_INVALID_RESPONSE",
      502,
      `Gemini returned malformed JSON for ${label}.`
    );
  }
}

/** Generates a structured, grounded multi-generational family air quality plan. */
export async function generateFamilyPlan(
  input: PlanRequestInput
): Promise<FamilyPlanResponse> {
  const ai = getGeminiClient();
  let text: string | undefined;

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: buildPlanUserPrompt(input),
        config: {
          systemInstruction: BASE_SAFETY_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: familyPlanGeminiSchema,
          temperature: 0.3,
        },
      })
    );
    text = response.text;
  } catch (err) {
    throw classifyGeminiError(err);
  }

  const parsedJson = parseJsonSafely(text, "family plan");
  const validated = familyPlanResponseSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new GeminiApiError(
      "AI_INVALID_RESPONSE",
      502,
      "Gemini returned a family plan that failed schema validation."
    );
  }
  return validated.data;
}

/** Generates a concise English or Hindi (Devanagari) WhatsApp family briefing. */
export async function generateWhatsAppBriefing(
  input: BriefingRequestInput
): Promise<BriefingResponse> {
  const ai = getGeminiClient();
  let text: string | undefined;

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: buildBriefingUserPrompt(input),
        config: {
          systemInstruction: BASE_SAFETY_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: briefingGeminiSchema,
          temperature: 0.4,
        },
      })
    );
    text = response.text;
  } catch (err) {
    throw classifyGeminiError(err);
  }

  const parsedJson = parseJsonSafely(text, "briefing") as {
    message?: unknown;
  };
  if (
    typeof parsedJson.message !== "string" ||
    parsedJson.message.trim().length === 0
  ) {
    throw new GeminiApiError(
      "AI_INVALID_RESPONSE",
      502,
      "Gemini returned an invalid briefing payload."
    );
  }

  return {
    language: input.language,
    message: parsedJson.message.trim(),
  };
}

/** Generates a context-grounded Family Air Copilot or SmogShift explanation reply. */
export async function generateCopilotReply(
  input: ChatRequestInput
): Promise<ChatResponse> {
  const ai = getGeminiClient();
  let text: string | undefined;

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: buildChatUserPrompt(input),
        config: {
          systemInstruction: BASE_SAFETY_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: chatGeminiSchema,
          temperature: 0.3,
        },
      })
    );
    text = response.text;
  } catch (err) {
    throw classifyGeminiError(err);
  }

  const parsedJson = parseJsonSafely(text, "copilot chat") as {
    reply?: unknown;
  };
  if (
    typeof parsedJson.reply !== "string" ||
    parsedJson.reply.trim().length === 0
  ) {
    throw new GeminiApiError(
      "AI_INVALID_RESPONSE",
      502,
      "Gemini returned an invalid chat payload."
    );
  }

  return {
    reply: parsedJson.reply.trim(),
  };
}
