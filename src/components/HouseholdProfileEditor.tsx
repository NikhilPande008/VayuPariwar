/**
 * Collapsible multi-generational household profile editor with accessible toggle pills.
 */
"use client";

import type {
  CommuteMode,
  HouseholdMemberRole,
  HouseholdProfile,
} from "@/types";

export const MEMBER_OPTIONS: { id: HouseholdMemberRole; label: string }[] = [
  { id: "commuter", label: "Daily Commuter" },
  { id: "child", label: "Young Children (0-12)" },
  { id: "senior", label: "Senior Citizens (60+)" },
  { id: "respiratory_sensitive", label: "Respiratory Sensitivity" },
];

const COMMUTE_OPTIONS: { id: CommuteMode; label: string }[] = [
  { id: "solo_car", label: "Solo Car" },
  { id: "two_wheeler", label: "2-Wheeler" },
  { id: "carpool", label: "Carpool" },
  { id: "metro_bus", label: "Metro / Bus" },
  { id: "wfh", label: "WFH" },
];

const KITCHEN_OPTIONS = [
  { id: "gas_no_chimney", label: "Gas (No Chimney)" },
  { id: "gas_with_chimney", label: "Gas + Chimney" },
  { id: "induction", label: "Induction" },
] as const;

interface HouseholdProfileEditorProps {
  profile: HouseholdProfile;
  onProfileChange: (next: HouseholdProfile) => void;
}

const PILL_BASE =
  "rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 focus-visible:outline-none";

export function HouseholdProfileEditor({
  profile,
  onProfileChange,
}: HouseholdProfileEditorProps) {
  const toggleMember = (role: HouseholdMemberRole) => {
    const exists = profile.members.includes(role);
    const nextMembers = exists
      ? profile.members.filter((m) => m !== role)
      : [...profile.members.filter((m) => m !== "general_adult"), role];
    onProfileChange({ ...profile, members: nextMembers });
  };

  return (
    <div
      id="household-profile-editor"
      className="mt-3 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"
    >
      {/* Members */}
      <div>
        <p className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
          Household Members (Multi-select)
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {MEMBER_OPTIONS.map((option) => {
            const active = profile.members.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleMember(option.id)}
                className={`${PILL_BASE} ${
                  active
                    ? "border-teal-700 bg-teal-700 text-white"
                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Commute Mode */}
      <div>
        <p className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
          Primary Commute Mode
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {COMMUTE_OPTIONS.map((option) => {
            const active = profile.commuteMode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onProfileChange({ ...profile, commuteMode: option.id })
                }
                className={`${PILL_BASE} ${
                  active
                    ? "border-teal-700 bg-teal-700 text-white"
                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Home Environment */}
      <div>
        <p className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
          Air Purification &amp; Flat Exposure
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={profile.hasHepaPurifier}
            onClick={() =>
              onProfileChange({ ...profile, hasHepaPurifier: true })
            }
            className={`${PILL_BASE} ${
              profile.hasHepaPurifier
                ? "border-teal-700 bg-teal-700 text-white"
                : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
            }`}
          >
            Owns HEPA Purifier
          </button>
          <button
            type="button"
            aria-pressed={!profile.hasHepaPurifier}
            onClick={() =>
              onProfileChange({ ...profile, hasHepaPurifier: false })
            }
            className={`${PILL_BASE} ${
              !profile.hasHepaPurifier
                ? "border-teal-700 bg-teal-700 text-white"
                : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
            }`}
          >
            Budget / No Purifier
          </button>
          <button
            type="button"
            aria-pressed={profile.flatExposure === "roadside_low"}
            onClick={() =>
              onProfileChange({
                ...profile,
                flatExposure:
                  profile.flatExposure === "roadside_low"
                    ? "high_rise"
                    : "roadside_low",
              })
            }
            className={`${PILL_BASE} border-slate-300 bg-white text-slate-800 hover:bg-slate-100`}
          >
            Floor:{" "}
            {profile.flatExposure === "roadside_low"
              ? "Roadside / Low"
              : "High-Rise"}
          </button>
        </div>
      </div>

      {/* Kitchen Setup */}
      <div>
        <p className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
          Kitchen Setup
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {KITCHEN_OPTIONS.map((k) => {
            const active = profile.kitchenSetup === k.id;
            return (
              <button
                key={k.id}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onProfileChange({ ...profile, kitchenSetup: k.id })
                }
                className={`${PILL_BASE} ${
                  active
                    ? "border-teal-700 bg-teal-700 text-white"
                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                }`}
              >
                {k.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
