/**
 * Main VayuPariwar 3-tab client shell orchestrating live AQI fetches, AbortController
 * race-condition protection, household profile state, and WCAG 2.1 AA tab navigation.
 */
"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  AlertTriangle,
  CalendarClock,
  MessageSquareHeart,
  SlidersHorizontal,
} from "lucide-react";
import type {
  AqiApiResponse,
  FamilyPlanResponse,
  HouseholdProfile,
  SmogShiftToggles,
} from "@/types";
import { TopContextBar } from "@/components/TopContextBar";
import { FamilyPlanTab } from "@/components/FamilyPlanTab";

const SmogShiftTab = dynamic(
  () => import("@/components/SmogShiftTab").then((mod) => mod.SmogShiftTab),
  {
    loading: () => (
      <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
    ),
  }
);

const BriefingChatTab = dynamic(
  () =>
    import("@/components/BriefingChatTab").then((mod) => mod.BriefingChatTab),
  {
    loading: () => (
      <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
    ),
  }
);

type TabId = "plan" | "smogshift" | "briefing";

const TABS: { id: TabId; label: string }[] = [
  { id: "plan", label: "Safe-Window Family Plan" },
  { id: "smogshift", label: "SmogShift Simulator" },
  { id: "briefing", label: "Family Briefing & Copilot" },
];

const DEFAULT_PROFILE: HouseholdProfile = {
  members: ["commuter", "child", "senior"],
  commuteMode: "solo_car",
  hasHepaPurifier: false,
  kitchenSetup: "gas_no_chimney",
  flatExposure: "roadside_low",
};

const DEFAULT_TOGGLES: SmogShiftToggles = {
  baselineCommute: "solo_car",
  selectedCommute: "solo_car",
  shiftToSafeWindow: false,
  indoorHabits: false,
  personalProtection: false,
};

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabId>("plan");
  const [selectedCityId, setSelectedCityId] = useState<string>("delhi");
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lon: number } | null>(
    null
  );
  const [geoLoading, setGeoLoading] = useState(false);

  const [aqiData, setAqiData] = useState<AqiApiResponse | null>(null);
  const [aqiLoading, setAqiLoading] = useState(true);
  const [aqiError, setAqiError] = useState<string | null>(null);

  const [profile, setProfile] = useState<HouseholdProfile>(DEFAULT_PROFILE);
  const [toggles, setToggles] = useState<SmogShiftToggles>(DEFAULT_TOGGLES);
  const [commuteDistanceKm, setCommuteDistanceKm] = useState<number>(20);

  const [plan, setPlan] = useState<FamilyPlanResponse | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const retryAqiAbortRef = useRef<AbortController | null>(null);
  const retryPlanAbortRef = useRef<AbortController | null>(null);

  const fetchAqi = useCallback(
    async (
      cityId: string,
      coords: { lat: number; lon: number } | null,
      signal?: AbortSignal
    ) => {
      setAqiLoading(true);
      setAqiError(null);
      setAqiData(null);
      setPlan(null);
      try {
        const query =
          cityId === "geo" && coords
            ? `lat=${coords.lat}&lon=${coords.lon}&city=Current%20Location`
            : `city=${encodeURIComponent(cityId)}`;

        const res = await fetch(`/api/aqi?${query}`, {
          cache: "no-store",
          signal,
        });
        const json = (await res.json()) as AqiApiResponse & { error?: string };
        if (signal?.aborted) return;
        if (!res.ok) {
          throw new Error(
            json.error ?? "Failed to fetch live air quality readings."
          );
        }
        setAqiData(json);
      } catch (err) {
        if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
          return;
        }
        setAqiData(null);
        setAqiError(
          err instanceof Error
            ? err.message
            : "Live air quality data is currently unreachable."
        );
      } finally {
        if (!signal?.aborted) {
          setAqiLoading(false);
        }
      }
    },
    []
  );

  const fetchPlan = useCallback(
    async (
      currentAqi: AqiApiResponse,
      currentProfile: HouseholdProfile,
      signal?: AbortSignal
    ) => {
      setPlanLoading(true);
      setPlanError(null);
      try {
        const res = await fetch("/api/plan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal,
          body: JSON.stringify({
            aqiContext: {
              city: currentAqi.city,
              stationName: currentAqi.stationName,
              measuredAt: currentAqi.measuredAt,
              sourceType: currentAqi.sourceType,
              aqi: currentAqi.naqi.aqi,
              category: currentAqi.naqi.category,
              primaryPollutant: currentAqi.naqi.primaryPollutant,
              pm25: currentAqi.pollutants.pm25,
              pm10: currentAqi.pollutants.pm10,
              bestWindow: currentAqi.safeWindow.bestWindow,
              peakWindow: currentAqi.safeWindow.peakWindow,
              reductionPercent: currentAqi.safeWindow.reductionPercent,
            },
            profile: currentProfile,
          }),
        });
        const json = (await res.json()) as FamilyPlanResponse & {
          error?: string;
        };
        if (signal?.aborted) return;
        if (!res.ok) {
          throw new Error(
            json.error ?? "Unable to generate personalized family plan."
          );
        }
        setPlan(json);
      } catch (err) {
        if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
          return;
        }
        setPlan(null);
        setPlanError(
          err instanceof Error
            ? err.message
            : "Could not load personalized AI plan."
        );
      } finally {
        if (!signal?.aborted) {
          setPlanLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    retryAqiAbortRef.current?.abort();
    const controller = new AbortController();
    void fetchAqi(selectedCityId, geoCoords, controller.signal);
    return () => {
      controller.abort();
      retryAqiAbortRef.current?.abort();
    };
  }, [fetchAqi, selectedCityId, geoCoords]);

  useEffect(() => {
    if (!aqiData) return;
    retryPlanAbortRef.current?.abort();
    const controller = new AbortController();
    void fetchPlan(aqiData, profile, controller.signal);
    return () => {
      controller.abort();
      retryPlanAbortRef.current?.abort();
    };
  }, [aqiData, profile, fetchPlan]);

  const handleRetryAqi = () => {
    retryAqiAbortRef.current?.abort();
    const controller = new AbortController();
    retryAqiAbortRef.current = controller;
    void fetchAqi(selectedCityId, geoCoords, controller.signal);
  };

  const handleRetryPlan = () => {
    if (!aqiData) return;
    retryPlanAbortRef.current?.abort();
    const controller = new AbortController();
    retryPlanAbortRef.current = controller;
    void fetchPlan(aqiData, profile, controller.signal);
  };

  const handleSelectCity = (cityId: string) => {
    setGeoCoords(null);
    setSelectedCityId(cityId);
  };

  const handleUseGeolocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setAqiError("Geolocation is not supported in this browser.");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoLoading(false);
        setGeoCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setSelectedCityId("geo");
      },
      () => {
        setGeoLoading(false);
        setAqiError(
          "Location permission was denied. Please choose a city from the dropdown."
        );
      },
      { timeout: 8000 }
    );
  };

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight") {
      nextIndex = (index + 1) % TABS.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (index - 1 + TABS.length) % TABS.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = TABS.length - 1;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      const nextTab = TABS[nextIndex];
      if (nextTab) {
        setActiveTab(nextTab.id);
        tabRefs.current[nextIndex]?.focus();
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-teal-800 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:ring-2 focus:ring-white focus:outline-none"
      >
        Skip to main content
      </a>

      <TopContextBar
        selectedCityId={selectedCityId}
        onSelectCity={handleSelectCity}
        onUseGeolocation={handleUseGeolocation}
        geoLoading={geoLoading}
        aqiData={aqiData}
        aqiLoading={aqiLoading}
        aqiError={aqiError}
        onRetryAqi={handleRetryAqi}
        profile={profile}
        onProfileChange={setProfile}
      />

      <main id="main-content" className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* 3-Tab Accessible Navigation */}
        <nav aria-label="Primary sections" className="mb-6">
          <div
            role="tablist"
            aria-label="VayuPariwar Assistant Sections"
            className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xs"
          >
            {TABS.map((tab, idx) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={(el) => {
                    tabRefs.current[idx] = el;
                  }}
                  id={`tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`panel-${tab.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 focus-visible:outline-none sm:text-sm ${
                    selected
                      ? "bg-teal-700 text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {tab.id === "plan" && (
                    <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  {tab.id === "smogshift" && (
                    <SlidersHorizontal
                      className="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  {tab.id === "briefing" && (
                    <MessageSquareHeart
                      className="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Truthful Error / Loading Gate — NEVER render hardcoded or fake AQI data */}
        {aqiLoading ? (
          <div className="space-y-4">
            <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white" />
              <div className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            </div>
          </div>
        ) : aqiError || !aqiData ? (
          <section
            role="alert"
            aria-live="polite"
            className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xs"
          >
            <AlertTriangle
              className="mx-auto h-10 w-10 text-red-600"
              aria-hidden="true"
            />
            <h2 className="mt-3 text-lg font-bold text-slate-900">
              Unable to Load Live Air Quality Data
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
              {aqiError ??
                "Both CPCB/WAQI and Open-Meteo data sources failed to respond. VayuPariwar never displays fabricated AQI metrics."}
            </p>
            <button
              type="button"
              onClick={handleRetryAqi}
              className="mt-5 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 focus-visible:outline-none"
            >
              Retry Live Fetch
            </button>
          </section>
        ) : (
          <div
            id={`panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
          >
            {activeTab === "plan" && (
              <FamilyPlanTab
                aqiData={aqiData}
                plan={plan}
                planLoading={planLoading}
                planError={planError}
                onRetryPlan={handleRetryPlan}
              />
            )}

            {activeTab === "smogshift" && (
              <SmogShiftTab
                aqiData={aqiData}
                profile={profile}
                toggles={toggles}
                onTogglesChange={setToggles}
                commuteDistanceKm={commuteDistanceKm}
                onDistanceChange={setCommuteDistanceKm}
              />
            )}

            {activeTab === "briefing" && (
              <BriefingChatTab
                aqiData={aqiData}
                profile={profile}
                toggles={toggles}
                commuteDistanceKm={commuteDistanceKm}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
