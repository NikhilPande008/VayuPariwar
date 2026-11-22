/**
 * Persistent top header bar displaying city selector, truthful live AQI status badge,
 * station attribution, and collapsible household profile summary.
 */
"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  LocateFixed,
  MapPin,
  Users,
  Wind,
} from "lucide-react";
import type { AqiApiResponse, HouseholdProfile } from "@/types";
import { INDIAN_CITIES } from "@/lib/aqi/cities";
import { AqiStatusPill } from "@/components/AqiStatusPill";
import {
  HouseholdProfileEditor,
  MEMBER_OPTIONS,
} from "@/components/HouseholdProfileEditor";

interface TopContextBarProps {
  selectedCityId: string;
  onSelectCity: (cityId: string) => void;
  onUseGeolocation: () => void;
  geoLoading: boolean;
  aqiData: AqiApiResponse | null;
  aqiLoading: boolean;
  aqiError: string | null;
  onRetryAqi: () => void;
  profile: HouseholdProfile;
  onProfileChange: (next: HouseholdProfile) => void;
}

export function TopContextBar({
  selectedCityId,
  onSelectCity,
  onUseGeolocation,
  geoLoading,
  aqiData,
  aqiLoading,
  aqiError,
  onRetryAqi,
  profile,
  onProfileChange,
}: TopContextBarProps) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="border-b border-slate-200 bg-white shadow-xs">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-white">
                <Wind className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                  VayuPariwar
                </h1>
                <p className="text-xs text-slate-600">
                  Family Air Quality Assistant
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="city-selector" className="sr-only">
                Select Indian City
              </label>
              <div className="relative flex items-center">
                <MapPin
                  className="pointer-events-none absolute left-2.5 h-4 w-4 text-slate-500"
                  aria-hidden="true"
                />
                <select
                  id="city-selector"
                  value={selectedCityId}
                  onChange={(e) => onSelectCity(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-slate-50 py-1.5 pr-8 pl-8 text-sm font-medium text-slate-900 focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/20 focus-visible:outline-none"
                >
                  {INDIAN_CITIES.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                  {selectedCityId === "geo" && (
                    <option value="geo">Current Location</option>
                  )}
                </select>
              </div>

              <button
                type="button"
                onClick={onUseGeolocation}
                disabled={geoLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 focus-visible:outline-none disabled:opacity-50"
                title="Detect my current location"
              >
                <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{geoLoading ? "Locating..." : "Locate"}</span>
              </button>
            </div>
          </div>

          <AqiStatusPill
            aqiData={aqiData}
            aqiLoading={aqiLoading}
            aqiError={aqiError}
            onRetryAqi={onRetryAqi}
          />
        </div>

        {/* Collapsible Household Profile Bar */}
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-700">
              <Users className="h-4 w-4 text-teal-700" aria-hidden="true" />
              <span className="font-semibold text-slate-900">Household:</span>
              {profile.members.length === 0 ? (
                <span className="rounded-full bg-teal-50 px-2.5 py-0.5 font-medium text-teal-900">
                  General Adult Household
                </span>
              ) : (
                profile.members.map((role) => {
                  const label =
                    role === "general_adult"
                      ? "General Adult Household"
                      : (MEMBER_OPTIONS.find((m) => m.id === role)?.label ??
                        role);
                  return (
                    <span
                      key={role}
                      className="rounded-full bg-teal-50 px-2.5 py-0.5 font-medium text-teal-900"
                    >
                      {label}
                    </span>
                  );
                })
              )}
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">
                {profile.hasHepaPurifier ? "HEPA Purifier" : "No Purifier"}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">
                {profile.flatExposure === "roadside_low"
                  ? "Roadside / Low Floor"
                  : "High-Rise"}
              </span>
            </div>

            <button
              type="button"
              aria-expanded={profileOpen}
              aria-controls="household-profile-editor"
              onClick={() => setProfileOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 focus-visible:outline-none"
            >
              <span>{profileOpen ? "Done" : "Edit Household"}</span>
              {profileOpen ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </div>

          {profileOpen && (
            <HouseholdProfileEditor
              profile={profile}
              onProfileChange={onProfileChange}
            />
          )}
        </div>
      </div>
    </header>
  );
}
