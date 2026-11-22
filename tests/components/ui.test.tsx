import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { TopContextBar } from "@/components/TopContextBar";
import { SmogShiftTab } from "@/components/SmogShiftTab";
import { BriefingChatTab } from "@/components/BriefingChatTab";
import HomePage from "@/app/page";
import type {
  AqiApiResponse,
  HouseholdProfile,
  SmogShiftToggles,
} from "@/types";

function makeAqi(city: string, aqi: number, stationName: string): AqiApiResponse {
  return {
    city,
    lat: 28.6139,
    lon: 77.209,
    stationName,
    measuredAt: "2026-11-22T12:00:00.000Z",
    sourceType: "fallback_model",
    sourceLabel: "Fallback: Open-Meteo Model",
    pollutants: { pm25: 185, pm10: 230 },
    naqi: {
      aqi,
      category: aqi > 300 ? "Very Poor" : "Moderate",
      primaryPollutant: "pm25",
      subIndices: { pm25: aqi, pm10: 187 },
      dataCompleteness: "partial",
    },
    hourly: Array.from({ length: 24 }, (_, hour) => ({
      time: `2026-11-22T${String(hour).padStart(2, "0")}:00`,
      hour,
      pm25: hour >= 14 && hour <= 16 ? 80 : 200,
    })),
    safeWindow: {
      bestWindow: {
        startHour: 14,
        endHour: 17,
        label: "2:00 PM - 5:00 PM",
        avgPm25: 80,
      },
      peakWindow: {
        startHour: 6,
        endHour: 9,
        label: "6:00 AM - 9:00 AM",
        avgPm25: 200,
      },
      reductionPercent: 60,
    },
  };
}

const SAMPLE_AQI = makeAqi("Delhi", 351, "Anand Vihar, Delhi (CPCB)");

const SAMPLE_PROFILE: HouseholdProfile = {
  members: ["commuter", "senior"],
  commuteMode: "solo_car",
  hasHepaPurifier: false,
  kitchenSetup: "gas_no_chimney",
  flatExposure: "roadside_low",
};

describe("UI Components — Accessibility, Resilience & Edge Cases", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders TopContextBar with truthful AQI badge, fallback label, station name, and collapsible profile pills", async () => {
    const user = userEvent.setup();
    const onProfileChange = vi.fn();

    render(
      <TopContextBar
        selectedCityId="delhi"
        onSelectCity={vi.fn()}
        onUseGeolocation={vi.fn()}
        geoLoading={false}
        aqiData={SAMPLE_AQI}
        aqiLoading={false}
        aqiError={null}
        onRetryAqi={vi.fn()}
        profile={SAMPLE_PROFILE}
        onProfileChange={onProfileChange}
      />
    );

    expect(screen.getByText(/NAQI 351/)).toBeInTheDocument();
    expect(screen.getByText("Very Poor")).toBeInTheDocument();
    expect(screen.getByText("Fallback: Open-Meteo Model")).toBeInTheDocument();
    expect(screen.getByText("Anand Vihar, Delhi (CPCB)")).toBeInTheDocument();

    const editBtn = screen.getByRole("button", { name: /Edit Household/i });
    expect(editBtn).toHaveAttribute("aria-expanded", "false");

    await user.click(editBtn);
    expect(editBtn).toHaveAttribute("aria-expanded", "true");

    const childPill = screen.getByRole("button", {
      name: /Young Children \(0-12\)/i,
    });
    expect(childPill).toHaveAttribute("aria-pressed", "false");
    await user.click(childPill);
    expect(onProfileChange).toHaveBeenCalledTimes(1);
  });

  it("renders General Adult Household fallback label when all member pills are unselected", () => {
    render(
      <TopContextBar
        selectedCityId="delhi"
        onSelectCity={vi.fn()}
        onUseGeolocation={vi.fn()}
        geoLoading={false}
        aqiData={SAMPLE_AQI}
        aqiLoading={false}
        aqiError={null}
        onRetryAqi={vi.fn()}
        profile={{ ...SAMPLE_PROFILE, members: [] }}
        onProfileChange={vi.fn()}
      />
    );

    expect(screen.getByText("General Adult Household")).toBeInTheDocument();
  });

  it("renders matching pollutant reading and unit when primary pollutant is PM10 or CO", () => {
    const pm10Aqi: AqiApiResponse = {
      ...SAMPLE_AQI,
      pollutants: { pm25: 55, pm10: 360, co: 2.4 },
      naqi: {
        ...SAMPLE_AQI.naqi,
        primaryPollutant: "pm10",
      },
    };
    const { rerender } = render(
      <TopContextBar
        selectedCityId="delhi"
        onSelectCity={vi.fn()}
        onUseGeolocation={vi.fn()}
        geoLoading={false}
        aqiData={pm10Aqi}
        aqiLoading={false}
        aqiError={null}
        onRetryAqi={vi.fn()}
        profile={SAMPLE_PROFILE}
        onProfileChange={vi.fn()}
      />
    );
    expect(screen.getByText(/Primary: PM10 \(360 µg\/m³\)/)).toBeInTheDocument();

    const coAqi: AqiApiResponse = {
      ...pm10Aqi,
      naqi: { ...pm10Aqi.naqi, primaryPollutant: "co" },
    };
    rerender(
      <TopContextBar
        selectedCityId="delhi"
        onSelectCity={vi.fn()}
        onUseGeolocation={vi.fn()}
        geoLoading={false}
        aqiData={coAqi}
        aqiLoading={false}
        aqiError={null}
        onRetryAqi={vi.fn()}
        profile={SAMPLE_PROFILE}
        onProfileChange={vi.fn()}
      />
    );
    expect(screen.getByText(/Primary: CO \(2\.4 mg\/m³\)/)).toBeInTheDocument();
  });

  it("updates SmogShift deterministic PM2.5 and CO2 meters immediately on toggle clicks", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [toggles, setToggles] = useState<SmogShiftToggles>({
        baselineCommute: "solo_car",
        selectedCommute: "solo_car",
        shiftToSafeWindow: false,
        indoorHabits: false,
        personalProtection: false,
      });
      const [distance, setDistance] = useState(20);

      return (
        <SmogShiftTab
          aqiData={SAMPLE_AQI}
          profile={SAMPLE_PROFILE}
          toggles={toggles}
          onTogglesChange={setToggles}
          commuteDistanceKm={distance}
          onDistanceChange={setDistance}
        />
      );
    }

    render(<Harness />);

    expect(screen.getByTestId("pm25-reduction-value")).toHaveTextContent("0%");
    expect(screen.getByTestId("co2-avoided-value")).toHaveTextContent("0.00");

    await user.click(screen.getByRole("button", { name: "Metro / Bus" }));
    expect(screen.getByTestId("co2-avoided-value")).toHaveTextContent("3.00");

    const timingBtn = screen.getByRole("button", {
      name: /2\. Shift Outdoor Timing/i,
    });
    await user.click(timingBtn);
    expect(timingBtn).toHaveAttribute("aria-pressed", "true");

    const n95Btn = screen.getByRole("button", {
      name: /4\. N95 \+ Draft Sealing/i,
    });
    await user.click(n95Btn);

    const updatedPctText =
      screen.getByTestId("pm25-reduction-value").textContent ?? "0%";
    const updatedPct = Number.parseInt(updatedPctText.replace("%", ""), 10);
    expect(updatedPct).toBeGreaterThan(50);
  });

  it("falls back to execCommand copy when navigator.clipboard is unavailable and announces via aria-live", async () => {
    const user = userEvent.setup();

    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });

    const execCommandMock = vi.fn(() => true);
    document.execCommand = execCommandMock;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            language: "en",
            message: "Hello Family! Safe window today is 2:00 PM - 5:00 PM.",
          }),
          { status: 200 }
        )
      )
    );

    render(
      <BriefingChatTab
        aqiData={SAMPLE_AQI}
        profile={SAMPLE_PROFILE}
        toggles={{
          baselineCommute: "solo_car",
          selectedCommute: "solo_car",
          shiftToSafeWindow: false,
          indoorHabits: false,
          personalProtection: false,
        }}
        commuteDistanceKm={20}
      />
    );

    await user.click(
      screen.getByRole("button", { name: /Generate English Briefing/i })
    );

    await screen.findByText(/Safe window today is 2:00 PM - 5:00 PM/i);

    await user.click(
      screen.getByRole("button", { name: /Copy to Clipboard/i })
    );

    expect(execCommandMock).toHaveBeenCalledWith("copy");
    expect(
      screen.getByText("Briefing copied to clipboard.")
    ).toBeInTheDocument();

    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
    });
  });

  it("aborts stale city requests on rapid switching and clears stale AQI data on 503 error", async () => {
    const user = userEvent.setup();

    let resolveDelhi: ((value: Response) => void) | undefined;
    const delhiAqi = makeAqi("Delhi", 380, "Delhi Slow Station");
    const puneAqi = makeAqi("Pune", 140, "Pune Fast Station");

    const fetchMock = vi.fn((input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/plan")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              headline: "Plan ready",
              memberPlans: [
                {
                  role: "Daily Commuter",
                  morning: "Mask up",
                  afternoon: "Safe window",
                  evening: "Stay indoors",
                },
              ],
              homeShieldHacks: [
                {
                  title: "Wet Mop",
                  action: "Use damp mop",
                  costTier: "Zero-Cost",
                  whyItWorks: "Reduces dust",
                },
              ],
              impactSummary: "Stay protected.",
            }),
            { status: 200 }
          )
        );
      }

      if (url.includes("city=delhi")) {
        return new Promise<Response>((resolve, reject) => {
          resolveDelhi = resolve;
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("Aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      }

      if (url.includes("city=pune")) {
        return Promise.resolve(
          new Response(JSON.stringify(puneAqi), { status: 200 })
        );
      }

      // Mumbai returns 503
      return Promise.resolve(
        new Response(
          JSON.stringify({
            error: "All upstream air quality sources are unavailable.",
            code: "AQI_SOURCES_UNAVAILABLE",
          }),
          { status: 503 }
        )
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<HomePage />);

    // Rapidly switch from Delhi (still pending) to Pune (resolves immediately)
    const select = screen.getByLabelText(/Select Indian City/i);
    await user.selectOptions(select, "pune");

    await screen.findByText("Pune Fast Station");
    expect(screen.getByText(/NAQI 140/)).toBeInTheDocument();

    // Even if Delhi's delayed resolver fires afterward, Pune must NOT be overwritten
    resolveDelhi?.(new Response(JSON.stringify(delhiAqi), { status: 200 }));
    await waitFor(() => {
      expect(screen.getByText("Pune Fast Station")).toBeInTheDocument();
      expect(screen.queryByText("Delhi Slow Station")).not.toBeInTheDocument();
    });

    // Now switch to Mumbai (503 error) — must clear Pune's stale AQI and show Retry
    await user.selectOptions(select, "mumbai");
    await screen.findByText(/Unable to Load Live Air Quality Data/i);
    expect(screen.queryByText("Pune Fast Station")).not.toBeInTheDocument();
    expect(screen.queryByText(/NAQI 140/)).not.toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: /Retry Live Fetch/i });
    expect(retryBtn).toBeInTheDocument();

    const callsBeforeRetry = fetchMock.mock.calls.length;
    await user.click(retryBtn);
    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
    });
  });

  it("supports accessible tab switching via click and keyboard arrows with role=tablist, aria-selected, and focus management", async () => {
    const user = userEvent.setup();
    const delhiAqi = makeAqi("Delhi", 320, "Anand Vihar, Delhi (CPCB)");

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.includes("/api/plan")) {
          return new Response(
            JSON.stringify({
              headline: "Stay indoors during morning smog.",
              memberPlans: [
                {
                  role: "Daily Commuter",
                  morning: "Wear N95.",
                  afternoon: "Step out 2-5 PM.",
                  evening: "Avoid outdoor jogs.",
                },
              ],
              homeShieldHacks: [
                {
                  title: "Wet Mop Floors",
                  action: "Damp mop instead of sweeping.",
                  costTier: "Zero-Cost",
                  whyItWorks: "Avoids resuspending settled PM2.5.",
                },
              ],
              impactSummary: "Timing shifts cut exposure.",
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify(delhiAqi), { status: 200 });
      })
    );

    render(<HomePage />);
    await screen.findByText("Anand Vihar, Delhi (CPCB)");

    expect(screen.getByRole("navigation", { name: /Primary sections/i })).toBeInTheDocument();
    expect(screen.getByRole("tablist")).toBeInTheDocument();

    const planTab = screen.getByRole("tab", { name: /Safe-Window Family Plan/i });
    const smogTab = screen.getByRole("tab", { name: /SmogShift Simulator/i });
    const briefingTab = screen.getByRole("tab", { name: /Family Briefing & Copilot/i });

    expect(planTab).toHaveAttribute("aria-selected", "true");
    expect(smogTab).toHaveAttribute("aria-selected", "false");
    expect(briefingTab).toHaveAttribute("aria-selected", "false");

    // Keyboard ArrowRight moves selection and focus to SmogShift tab
    planTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(smogTab).toHaveAttribute("aria-selected", "true");
    expect(smogTab).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "panel-smogshift");

    // Keyboard ArrowRight moves to Briefing tab
    await user.keyboard("{ArrowRight}");
    expect(briefingTab).toHaveAttribute("aria-selected", "true");
    expect(briefingTab).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "panel-briefing");

    // Click returns to Safe-Window Family Plan tab
    await user.click(planTab);
    expect(planTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "panel-plan");
  });
});
