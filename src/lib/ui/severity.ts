import type { NaqiCategory } from "@/types";

export interface SeverityStyle {
  category: NaqiCategory;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  accentHex: string;
  iconName: "check" | "smile" | "info" | "alert" | "shield" | "octagon";
  shortGuidance: string;
}

/**
 * WCAG 2.1 AA compliant color + icon + text mappings for Indian CPCB NAQI categories.
 * Color is never used alone; every badge renders an icon and text label alongside these styles.
 */
export const NAQI_SEVERITY_STYLES: Record<NaqiCategory, SeverityStyle> = {
  Good: {
    category: "Good",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-900",
    badgeBorder: "border-emerald-300",
    accentHex: "#059669",
    iconName: "check",
    shortGuidance: "Minimal health impact. Great air for outdoor activities.",
  },
  Satisfactory: {
    category: "Satisfactory",
    badgeBg: "bg-lime-50",
    badgeText: "text-lime-900",
    badgeBorder: "border-lime-400",
    accentHex: "#65a30d",
    iconName: "smile",
    shortGuidance: "Minor breathing discomfort possible for very sensitive people.",
  },
  Moderate: {
    category: "Moderate",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-950",
    badgeBorder: "border-amber-400",
    accentHex: "#d97706",
    iconName: "info",
    shortGuidance: "Limit prolonged exertion for children, seniors, and asthma patients.",
  },
  Poor: {
    category: "Poor",
    badgeBg: "bg-orange-50",
    badgeText: "text-orange-950",
    badgeBorder: "border-orange-400",
    accentHex: "#ea580c",
    iconName: "alert",
    shortGuidance: "Use the Safe Window for outdoor errands and keep indoor air clean.",
  },
  "Very Poor": {
    category: "Very Poor",
    badgeBg: "bg-red-50",
    badgeText: "text-red-950",
    badgeBorder: "border-red-400",
    accentHex: "#dc2626",
    iconName: "shield",
    shortGuidance: "Avoid morning/late-night smog peaks. Wear an N95 mask outdoors.",
  },
  Severe: {
    category: "Severe",
    badgeBg: "bg-rose-100",
    badgeText: "text-rose-950",
    badgeBorder: "border-rose-500",
    accentHex: "#9f1239",
    iconName: "octagon",
    shortGuidance: "Health alert: stay indoors as much as possible and seal drafts.",
  },
};

export function formatMeasuredTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
