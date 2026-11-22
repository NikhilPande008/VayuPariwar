/**
 * System instructions, normalized cache-key builders, and grounded user prompt builders for Gemini 2.5 Flash.
 */
import type { HouseholdProfile } from "@/types";
import type {
  AqiContextInput,
  BriefingRequestInput,
  ChatRequestInput,
  PlanRequestInput,
} from "@/lib/validation/schemas";

export const BASE_SAFETY_SYSTEM_INSTRUCTION = `You are VayuPariwar, an empathetic, science-grounded Urban Air Quality Assistant for Indian families.

STRICT GROUNDING RULES:
1. ONLY use the verified air quality numbers, station name, safe window, peak window, and SmogShift percentages provided in the JSON context. NEVER invent, estimate, or alter AQI scores, PM2.5 values, or CO2 numbers.
2. NEVER prescribe medications, inhalers, dosages, or medical diagnoses. For respiratory symptoms or asthma concerns, recommend consulting a qualified doctor while offering practical non-medical exposure-reduction steps.
3. Tailor every recommendation to Indian urban life (CPCB NAQI context, morning/evening smog inversions, wet mopping vs dry sweeping, kitchen exhaust/chimney, skipping incense/dhoop during high smog, N95 masks, DIY Corsi-Rosenthal box if no HEPA purifier is owned).
4. Keep language crisp, warm, practical, and free of technical jargon.`;

export function hashHouseholdProfile(profile: HouseholdProfile): string {
  const sortedMembers = [...profile.members].sort().join(",");
  return [
    sortedMembers,
    profile.commuteMode,
    profile.hasHepaPurifier ? "hepa" : "nohepa",
    profile.kitchenSetup,
    profile.flatExposure,
  ].join("|");
}

export function buildPlanCacheKey(
  aqiContext: AqiContextInput,
  profile: HouseholdProfile
): string {
  const cityKey = aqiContext.city.trim().toLowerCase().replace(/\s+/g, "-");
  const catKey = aqiContext.category.toLowerCase().replace(/\s+/g, "-");
  const profileHash = hashHouseholdProfile(profile);
  return `${cityKey}_${catKey}_${profileHash}`;
}

export function buildPlanUserPrompt(input: PlanRequestInput): string {
  return `Generate a personalized daily Safe-Window Family Plan and Home Shield indoor air guide for this Indian household.

VERIFIED CONTEXT JSON:
${JSON.stringify(
  {
    aqi: input.aqiContext,
    household: input.profile,
    smogShift: input.smogShift ?? null,
  },
  null,
  2
)}

REQUIREMENTS:
- Provide one memberPlan entry for EACH member role in household.members (use human-readable role labels like "Daily Commuter", "Young Children (0-12 yrs)", "Senior Citizens (60+ yrs)", "Respiratory Sensitive").
- Ground Morning, Afternoon, and Evening guidance directly in bestWindow (${input.aqiContext.bestWindow.label}) and peakWindow (${input.aqiContext.peakWindow.label}).
- Provide 3 to 4 prioritized homeShieldHacks tailored to hasHepaPurifier=${String(input.profile.hasHepaPurifier)}, kitchenSetup=${input.profile.kitchenSetup}, and flatExposure=${input.profile.flatExposure}. If hasHepaPurifier is false, include a zero-cost or low-cost hack such as wet mopping, exact cross-ventilation during bestWindow, or a DIY Corsi-Rosenthal box.
- Keep impactSummary to 2 crisp sentences summarizing today's protection opportunity.`;
}

export function buildBriefingUserPrompt(input: BriefingRequestInput): string {
  const langDirective =
    input.language === "hi"
      ? "Write the entire WhatsApp message in natural, warm, respectful Hindi (Devanagari script, e.g., 'नमस्ते परिवार') suitable for Indian parents and grandparents. Keep numeric AQI values, times, and 'N95' / 'PM2.5' clearly readable."
      : "Write the WhatsApp message in clear, warm Indian English suitable for a family WhatsApp group.";

  return `Draft a concise, WhatsApp-ready daily air quality family briefing.

VERIFIED CONTEXT JSON:
${JSON.stringify(
  {
    aqi: input.aqiContext,
    household: input.profile,
    smogShift: input.smogShift ?? null,
  },
  null,
  2
)}

REQUIREMENTS:
- ${langDirective}
- Mention the city (${input.aqiContext.city}), exact NAQI (${input.aqiContext.aqi} - ${input.aqiContext.category}), best safe window (${input.aqiContext.bestWindow.label}), and peak smog hours to avoid (${input.aqiContext.peakWindow.label}).
- Include 2-3 bulleted Home Shield steps tailored to the household setup.
- Include one gentle, empathetic nudge for seniors or commuters (e.g., kindly shifting a morning walk to the safe window to protect their lungs).
- Keep it concise (under 180 words) with clean WhatsApp formatting (*bold* headers and simple bullets).`;
}

export function buildChatUserPrompt(input: ChatRequestInput): string {
  if (input.mode === "smogshift_explain") {
    return `Explain in 2-3 clear, jargon-free sentences why the user's current SmogShift choices matter today, grounded strictly in these verified numbers:
${JSON.stringify(
  {
    aqi: input.aqiContext,
    household: input.profile,
    smogShift: input.smogShift ?? null,
  },
  null,
  2
)}
User request: ${input.message}`;
  }

  return `Answer the family's follow-up question concisely (2-4 sentences) using ONLY the verified context below. If the question asks for medical prescriptions, decline politely and recommend consulting a doctor.

VERIFIED CONTEXT JSON:
${JSON.stringify(
  {
    aqi: input.aqiContext,
    household: input.profile,
    smogShift: input.smogShift ?? null,
  },
  null,
  2
)}

USER QUESTION:
${input.message}`;
}
