/**
 * Tab 1 — Safe-Window Family Plan combining the dynamically loaded 24-hour PM2.5 timeline
 * with role-based Morning/Afternoon/Evening action cards and budget-aware Home Shield hacks.
 */
"use client";

import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Home,
  RefreshCw,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  UserCheck,
} from "lucide-react";
import type { AqiApiResponse, FamilyPlanResponse } from "@/types";

const SafeWindowChart = dynamic(
  () =>
    import("@/components/SafeWindowChart").then((mod) => mod.SafeWindowChart),
  {
    ssr: false,
    loading: () => (
      <div
        aria-busy="true"
        className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
      />
    ),
  }
);

interface FamilyPlanTabProps {
  aqiData: AqiApiResponse;
  plan: FamilyPlanResponse | null;
  planLoading: boolean;
  planError: string | null;
  onRetryPlan: () => void;
}

const COST_TIER_STYLES: Record<
  "Zero-Cost" | "Low-Cost" | "Device",
  string
> = {
  "Zero-Cost": "border-emerald-300 bg-emerald-50 text-emerald-900",
  "Low-Cost": "border-amber-300 bg-amber-50 text-amber-950",
  Device: "border-sky-300 bg-sky-50 text-sky-900",
};

export function FamilyPlanTab({
  aqiData,
  plan,
  planLoading,
  planError,
  onRetryPlan,
}: FamilyPlanTabProps) {
  return (
    <div className="space-y-6">
      {/* 24-Hour Safe-Window Chart */}
      <SafeWindowChart
        hourly={aqiData.hourly}
        safeWindow={aqiData.safeWindow}
      />

      {/* AI-Synthesized Role-Based Action Cards & Home Shield */}
      <div aria-live="polite" className="space-y-6">
        {planLoading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-2 text-sm font-medium text-teal-800">
              <RefreshCw
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              <span>
                Personalizing Safe-Window plan & Home Shield hacks for your
                household...
              </span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
            </div>
          </section>
        ) : planError ? (
          <section
            role="alert"
            className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle
                  className="mt-0.5 h-5 w-5 shrink-0 text-amber-800"
                  aria-hidden="true"
                />
                <div>
                  <h2 className="text-sm font-bold">
                    AI Family Plan Temporarily Unavailable
                  </h2>
                  <p className="mt-0.5 text-xs text-amber-900">{planError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onRetryPlan}
                className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-950 focus-visible:ring-2 focus-visible:ring-amber-800 focus-visible:ring-offset-1 focus-visible:outline-none"
              >
                Retry Plan
              </button>
            </div>
          </section>
        ) : plan ? (
          <>
            {/* Headline Banner */}
            <section className="rounded-2xl border border-teal-200 bg-teal-50/70 p-5">
              <div className="flex items-start gap-2.5">
                <Sparkles
                  className="mt-0.5 h-5 w-5 shrink-0 text-teal-800"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs font-semibold tracking-wide text-teal-800 uppercase">
                    Today&apos;s Family Guidance
                  </p>
                  <h2 className="mt-1 text-base font-bold text-slate-900">
                    {plan.headline}
                  </h2>
                  <p className="mt-1 text-sm text-slate-700">
                    {plan.impactSummary}
                  </p>
                </div>
              </div>
            </section>

            {/* Role-Based Action Cards */}
            <section aria-labelledby="role-plans-heading">
              <div className="mb-3 flex items-center gap-2">
                <UserCheck
                  className="h-5 w-5 text-teal-700"
                  aria-hidden="true"
                />
                <h2
                  id="role-plans-heading"
                  className="text-base font-bold text-slate-900"
                >
                  Role-Based Action Cards
                </h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {plan.memberPlans.map((member) => (
                  <article
                    key={member.role}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
                  >
                    <h3 className="text-sm font-bold text-slate-900">
                      {member.role}
                    </h3>
                    <dl className="mt-3 space-y-2.5 text-xs text-slate-700">
                      <div className="flex items-start gap-2">
                        <dt className="flex w-24 shrink-0 items-center gap-1 font-semibold text-slate-900">
                          <Sunrise
                            className="h-3.5 w-3.5 text-amber-600"
                            aria-hidden="true"
                          />
                          Morning
                        </dt>
                        <dd>{member.morning}</dd>
                      </div>
                      <div className="flex items-start gap-2">
                        <dt className="flex w-24 shrink-0 items-center gap-1 font-semibold text-slate-900">
                          <Sun
                            className="h-3.5 w-3.5 text-emerald-600"
                            aria-hidden="true"
                          />
                          Afternoon
                        </dt>
                        <dd>{member.afternoon}</dd>
                      </div>
                      <div className="flex items-start gap-2">
                        <dt className="flex w-24 shrink-0 items-center gap-1 font-semibold text-slate-900">
                          <Sunset
                            className="h-3.5 w-3.5 text-indigo-600"
                            aria-hidden="true"
                          />
                          Evening
                        </dt>
                        <dd>{member.evening}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </section>

            {/* Home Shield (Indoor Air Hacks) */}
            <section aria-labelledby="home-shield-heading">
              <div className="mb-3 flex items-center gap-2">
                <Home className="h-5 w-5 text-teal-700" aria-hidden="true" />
                <h2
                  id="home-shield-heading"
                  className="text-base font-bold text-slate-900"
                >
                  Home Shield — Indoor Air Hacks
                </h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {plan.homeShieldHacks.map((hack) => (
                  <article
                    key={hack.title}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        {hack.title}
                      </h3>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${COST_TIER_STYLES[hack.costTier]}`}
                      >
                        {hack.costTier}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-medium text-slate-800">
                      {hack.action}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-600">
                      <strong className="font-semibold text-slate-700">
                        Why it works:
                      </strong>{" "}
                      {hack.whyItWorks}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
