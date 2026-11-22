/**
 * Gemini structured JSON responseSchema definitions for Family Plan, Briefing, and Copilot routes.
 */
import { Type, type Schema } from "@google/genai";

export const familyPlanGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    memberPlans: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          role: { type: Type.STRING },
          morning: { type: Type.STRING },
          afternoon: { type: Type.STRING },
          evening: { type: Type.STRING },
        },
        required: ["role", "morning", "afternoon", "evening"],
      },
    },
    homeShieldHacks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          action: { type: Type.STRING },
          costTier: {
            type: Type.STRING,
            enum: ["Zero-Cost", "Low-Cost", "Device"],
          },
          whyItWorks: { type: Type.STRING },
        },
        required: ["title", "action", "costTier", "whyItWorks"],
      },
    },
    impactSummary: { type: Type.STRING },
  },
  required: ["headline", "memberPlans", "homeShieldHacks", "impactSummary"],
};

export const briefingGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    message: { type: Type.STRING },
  },
  required: ["message"],
};

export const chatGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING },
  },
  required: ["reply"],
};
