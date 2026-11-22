/**
 * Shared TypeScript domain interfaces for CPCB NAQI, Safe-Window, SmogShift, household profiles, and API responses.
 */
export type NaqiCategory =
  | "Good"
  | "Satisfactory"
  | "Moderate"
  | "Poor"
  | "Very Poor"
  | "Severe";

export type PollutantKey = "pm25" | "pm10" | "no2" | "o3" | "co";

export interface PollutantReadings {
  pm25?: number | null;
  pm10?: number | null;
  no2?: number | null;
  o3?: number | null;
  co?: number | null;
}

export type DataCompleteness = "complete" | "partial";

export interface NaqiResult {
  aqi: number;
  category: NaqiCategory;
  primaryPollutant: PollutantKey;
  subIndices: Partial<Record<PollutantKey, number>>;
  dataCompleteness: DataCompleteness;
}

export interface NaqiErrorState {
  code: "NO_VALID_POLLUTANTS";
  message: string;
}

export type NaqiOutcome =
  | { ok: true; result: NaqiResult }
  | { ok: false; error: NaqiErrorState };

export interface HourlyAqiPoint {
  time: string;
  hour: number;
  pm25: number;
  pm10?: number;
}

export interface HourlyAqiPointInput {
  time: string;
  hour: number;
  pm25: number | null | undefined;
  pm10?: number | null;
}

export interface TimeWindow {
  startHour: number;
  endHour: number;
  label: string;
  avgPm25: number;
}

export interface SafeWindowResult {
  bestWindow: TimeWindow;
  peakWindow: TimeWindow;
  reductionPercent: number;
}

export type CommuteMode =
  | "solo_car"
  | "two_wheeler"
  | "carpool"
  | "metro_bus"
  | "wfh";

export type BaselineCommuteMode = "solo_car" | "two_wheeler";

export interface SmogShiftToggles {
  baselineCommute: BaselineCommuteMode;
  selectedCommute: CommuteMode;
  shiftToSafeWindow: boolean;
  indoorHabits: boolean;
  personalProtection: boolean;
}

export interface SmogShiftResult {
  pm25ReductionPercent: number;
  co2AvoidedKgPerDay: number;
  estimatedBaselinePm25: number;
  estimatedProtectedPm25: number;
  breakdown: {
    outdoorTimingPct: number;
    personalProtectionPct: number;
    indoorHabitsPct: number;
    commuteShiftPct: number;
  };
}

export type HouseholdMemberRole =
  | "commuter"
  | "child"
  | "senior"
  | "respiratory_sensitive"
  | "general_adult";

export interface HouseholdProfile {
  members: HouseholdMemberRole[];
  commuteMode: CommuteMode;
  hasHepaPurifier: boolean;
  kitchenSetup: "gas_with_chimney" | "gas_no_chimney" | "induction";
  flatExposure: "roadside_low" | "high_rise";
}

export type DataSourceType = "cpcb_waqi" | "fallback_model";

export interface AqiApiResponse {
  city: string;
  lat: number;
  lon: number;
  stationName: string;
  measuredAt: string;
  sourceType: DataSourceType;
  sourceLabel: string;
  pollutants: PollutantReadings;
  naqi: NaqiResult;
  hourly: HourlyAqiPoint[];
  safeWindow: SafeWindowResult;
}

export interface MemberPlan {
  role: string;
  morning: string;
  afternoon: string;
  evening: string;
}

export interface HomeShieldHack {
  title: string;
  action: string;
  costTier: "Zero-Cost" | "Low-Cost" | "Device";
  whyItWorks: string;
}

export interface FamilyPlanResponse {
  headline: string;
  memberPlans: MemberPlan[];
  homeShieldHacks: HomeShieldHack[];
  impactSummary: string;
}

export interface BriefingResponse {
  language: "en" | "hi";
  message: string;
}

export interface ChatResponse {
  reply: string;
}
