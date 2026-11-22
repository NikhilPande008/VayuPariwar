/**
 * WhatsApp-ready English / Hindi family briefing generator card with clipboard fallback
 * and polite aria-live status announcements.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, RefreshCw, Share2 } from "lucide-react";
import type {
  AqiContextInput,
  SmogShiftSummaryInput,
} from "@/lib/validation/schemas";
import type { HouseholdProfile } from "@/types";

interface WhatsAppBriefingCardProps {
  city: string;
  sharedContext: {
    aqiContext: AqiContextInput;
    profile: HouseholdProfile;
    smogShift: SmogShiftSummaryInput;
  };
}

function fallbackCopyText(text: string): boolean {
  if (typeof document === "undefined") return false;
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(el);
  el.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(el);
  }
}

export function WhatsAppBriefingCard({
  city,
  sharedContext,
}: WhatsAppBriefingCardProps) {
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [briefingText, setBriefingText] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyStatusMessage, setCopyStatusMessage] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleGenerateBriefing = async (lang: "en" | "hi" = language) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBriefingLoading(true);
    setBriefingError(null);
    setCopied(false);

    try {
      const response = await fetch("/api/briefing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          language: lang,
          ...sharedContext,
        }),
      });

      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };
      if (controller.signal.aborted) return;
      if (!response.ok || !data.message) {
        throw new Error(data.error ?? "Unable to generate WhatsApp briefing.");
      }
      setBriefingText(data.message);
    } catch (err) {
      if (
        controller.signal.aborted ||
        (err instanceof Error && err.name === "AbortError")
      ) {
        return;
      }
      setBriefingError(
        err instanceof Error
          ? err.message
          : "Failed to generate family briefing."
      );
    } finally {
      if (!controller.signal.aborted) {
        setBriefingLoading(false);
      }
    }
  };

  const announceCopied = () => {
    setCopied(true);
    setCopyStatusMessage("Briefing copied to clipboard.");
    setTimeout(() => {
      setCopied(false);
      setCopyStatusMessage("");
    }, 2500);
  };

  const handleCopy = async () => {
    if (!briefingText) return;
    setBriefingError(null);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(briefingText);
      } else if (!fallbackCopyText(briefingText)) {
        throw new Error("Copy command failed");
      }
      announceCopied();
    } catch {
      if (fallbackCopyText(briefingText)) {
        announceCopied();
      } else {
        setCopyStatusMessage(
          "Unable to copy automatically. Please select and copy the text."
        );
        setBriefingError("Clipboard access was blocked by your browser.");
      }
    }
  };

  return (
    <section
      aria-labelledby="briefing-heading"
      className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          <h2
            id="briefing-heading"
            className="text-base font-bold text-slate-900"
          >
            WhatsApp Family Briefing
          </h2>
        </div>

        <div
          className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-0.5"
          role="group"
          aria-label="Briefing language"
        >
          <button
            type="button"
            aria-pressed={language === "en"}
            onClick={() => setLanguage("en")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 focus-visible:outline-none ${
              language === "en"
                ? "bg-teal-700 text-white"
                : "text-slate-700 hover:bg-slate-200/60"
            }`}
          >
            English
          </button>
          <button
            type="button"
            aria-pressed={language === "hi"}
            onClick={() => setLanguage("hi")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 focus-visible:outline-none ${
              language === "hi"
                ? "bg-teal-700 text-white"
                : "text-slate-700 hover:bg-slate-200/60"
            }`}
          >
            हिन्दी (Hindi)
          </button>
        </div>
      </div>

      <p className="mt-1.5 text-xs text-slate-600">
        One-click empathetic summary with today&apos;s Safe Window, Home Shield
        steps, and gentle nudges for seniors &amp; commuters.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleGenerateBriefing(language)}
          disabled={briefingLoading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 focus-visible:outline-none disabled:opacity-60"
        >
          {briefingLoading ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>
            {briefingLoading
              ? "Drafting Briefing..."
              : `Generate ${language === "hi" ? "Hindi" : "English"} Briefing`}
          </span>
        </button>

        {briefingText && (
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 focus-visible:outline-none"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{copied ? "Copied!" : "Copy to Clipboard"}</span>
          </button>
        )}
      </div>

      <div aria-live="polite" className="sr-only">
        {copyStatusMessage}
      </div>

      <div aria-live="polite" className="mt-4 flex-1">
        {briefingError ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900"
          >
            {briefingError}
          </p>
        ) : briefingText ? (
          <div className="whitespace-pre-wrap rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-sm leading-relaxed text-slate-900">
            {briefingText}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
            Click <strong>Generate</strong> to create a ready-to-share WhatsApp
            message grounded in {city}&apos;s live station data.
          </div>
        )}
      </div>
    </section>
  );
}
