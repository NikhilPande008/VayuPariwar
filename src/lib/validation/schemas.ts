import { z } from "zod";

export const aqiQuerySchema = z
  .object({
    city: z.string().trim().min(1).max(60).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine(
    (data) =>
      Boolean(data.city) ||
      (data.lat !== undefined && data.lon !== undefined),
    {
      message: "Provide either a valid city name or both lat and lon coordinates.",
    }
  );

export const commuteModeSchema = z.enum([
  "solo_car",
  "two_wheeler",
  "carpool",
  "metro_bus",
  "wfh",
]);

export const householdMemberRoleSchema = z.enum([
  "commuter",
  "child",
  "senior",
  "respiratory_sensitive",
  "general_adult",
]);

export const householdProfileSchema = z.object({
  members: z
    .array(householdMemberRoleSchema)
    .max(5)
    .default([])
    .transform((arr): z.infer<typeof householdMemberRoleSchema>[] =>
      arr.length === 0 ? ["general_adult"] : Array.from(new Set(arr))
    ),
  commuteMode: commuteModeSchema,
  hasHepaPurifier: z.boolean(),
  kitchenSetup: z.enum(["gas_with_chimney", "gas_no_chimney", "induction"]),
  flatExposure: z.enum(["roadside_low", "high_rise"]),
});

export const naqiCategorySchema = z.enum([
  "Good",
  "Satisfactory",
  "Moderate",
  "Poor",
  "Very Poor",
  "Severe",
]);

export const timeWindowSchema = z.object({
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(0).max(23),
  label: z.string().min(1).max(60),
  avgPm25: z.number().min(0).max(2000),
});

export const aqiContextSchema = z.object({
  city: z.string().trim().min(1).max(60),
  stationName: z.string().trim().min(1).max(160),
  measuredAt: z.string().min(1).max(64),
  sourceType: z.enum(["cpcb_waqi", "fallback_model"]),
  aqi: z.number().min(0).max(500),
  category: naqiCategorySchema,
  primaryPollutant: z.enum(["pm25", "pm10", "no2", "o3", "co"]),
  pm25: z.number().min(0).max(2000).optional(),
  pm10: z.number().min(0).max(3000).optional(),
  bestWindow: timeWindowSchema,
  peakWindow: timeWindowSchema,
  reductionPercent: z.number().min(0).max(100),
});

export const smogShiftSummarySchema = z.object({
  pm25ReductionPercent: z.number().min(0).max(100),
  co2AvoidedKgPerDay: z.number().min(0).max(100),
  selectedCommute: commuteModeSchema,
  shiftToSafeWindow: z.boolean(),
  indoorHabits: z.boolean(),
  personalProtection: z.boolean(),
});

export const planRequestSchema = z.object({
  aqiContext: aqiContextSchema,
  profile: householdProfileSchema,
  smogShift: smogShiftSummarySchema.optional(),
});

export const familyPlanResponseSchema = z.object({
  headline: z.string().min(1),
  memberPlans: z
    .array(
      z.object({
        role: z.string().min(1),
        morning: z.string().min(1),
        afternoon: z.string().min(1),
        evening: z.string().min(1),
      })
    )
    .min(1),
  homeShieldHacks: z
    .array(
      z.object({
        title: z.string().min(1),
        action: z.string().min(1),
        costTier: z.enum(["Zero-Cost", "Low-Cost", "Device"]),
        whyItWorks: z.string().min(1),
      })
    )
    .min(1),
  impactSummary: z.string().min(1),
});

export const briefingRequestSchema = z.object({
  language: z.enum(["en", "hi"]),
  aqiContext: aqiContextSchema,
  profile: householdProfileSchema,
  smogShift: smogShiftSummarySchema.optional(),
});

/**
 * Strips ASCII control tokens, zero-width characters, and common prompt-injection delimiters.
 */
export function sanitizeUserText(input: string): string {
  return input
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, " ")
    .replace(/<\|.*?\|>/g, " ")
    .replace(/```+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const chatRequestSchema = z.object({
  message: z
    .string()
    .transform((val) => sanitizeUserText(val))
    .pipe(
      z
        .string()
        .min(1, "Message cannot be empty.")
        .max(300, "Message must be 300 characters or fewer.")
    ),
  aqiContext: aqiContextSchema,
  profile: householdProfileSchema,
  smogShift: smogShiftSummarySchema.optional(),
  mode: z.enum(["copilot", "smogshift_explain"]).default("copilot"),
});

export type AqiContextInput = z.infer<typeof aqiContextSchema>;
export type SmogShiftSummaryInput = z.infer<typeof smogShiftSummarySchema>;
export type PlanRequestInput = z.infer<typeof planRequestSchema>;
export type BriefingRequestInput = z.infer<typeof briefingRequestSchema>;
export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
