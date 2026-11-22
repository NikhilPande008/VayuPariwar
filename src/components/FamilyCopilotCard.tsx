/**
 * Context-grounded Family Air Copilot Q&A card with starter prompt chips,
 * 300-character input cap, and AbortController cleanup.
 */
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageSquare, Send } from "lucide-react";
import type {
  AqiContextInput,
  SmogShiftSummaryInput,
} from "@/lib/validation/schemas";
import type { HouseholdProfile } from "@/types";

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
}

const STARTER_QUESTIONS = [
  "Is it safe to take my 5-year-old to the park at 5 PM?",
  "How should grandparents adjust their morning walk today?",
  "Best zero-cost way to keep indoor air clean tonight?",
];

interface FamilyCopilotCardProps {
  city: string;
  aqi: number;
  sharedContext: {
    aqiContext: AqiContextInput;
    profile: HouseholdProfile;
    smogShift: SmogShiftSummaryInput;
  };
}

export function FamilyCopilotCard({
  city,
  aqi,
  sharedContext,
}: FamilyCopilotCardProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || chatLoading) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setChatError(null);
    setChatLoading(true);
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, sender: "user", text: trimmed },
    ]);
    setInput("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          mode: "copilot",
          message: trimmed,
          ...sharedContext,
        }),
      });

      const data = (await response.json()) as { reply?: string; error?: string };
      if (controller.signal.aborted) return;
      const replyText = data.reply;
      if (!response.ok || !replyText) {
        throw new Error(data.error ?? "Copilot could not answer right now.");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          sender: "assistant",
          text: replyText,
        },
      ]);
    } catch (err) {
      if (
        controller.signal.aborted ||
        (err instanceof Error && err.name === "AbortError")
      ) {
        return;
      }
      setChatError(
        err instanceof Error ? err.message : "Failed to reach Copilot."
      );
    } finally {
      if (!controller.signal.aborted) {
        setChatLoading(false);
      }
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendQuestion(input);
  };

  return (
    <section
      aria-labelledby="copilot-heading"
      className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
    >
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-teal-700" aria-hidden="true" />
        <h2 id="copilot-heading" className="text-base font-bold text-slate-900">
          Family Air Copilot
        </h2>
      </div>
      <p className="mt-1 text-xs text-slate-600">
        Pre-grounded in {city}&apos;s live NAQI ({aqi}) and your household
        profile.
      </p>

      {/* Starter Question Chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {STARTER_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => void sendQuestion(q)}
            disabled={chatLoading}
            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-left text-[11px] font-medium text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 focus-visible:outline-none disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages Thread */}
      <div
        aria-live="polite"
        className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3.5 min-h-48 max-h-72"
      >
        {messages.length === 0 ? (
          <p className="text-xs text-slate-500">
            Ask a follow-up question about outdoor timing, kids&apos; play,
            seniors&apos; walks, or indoor air care.
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                msg.sender === "user"
                  ? "ml-8 bg-teal-700 text-white"
                  : "mr-8 border border-slate-200 bg-white text-slate-800"
              }`}
            >
              <span className="sr-only">
                {msg.sender === "user" ? "You asked: " : "VayuPariwar replied: "}
              </span>
              {msg.text}
            </div>
          ))
        )}
        {chatLoading && (
          <p className="text-xs font-medium text-teal-800">
            VayuPariwar is thinking...
          </p>
        )}
        {chatError && (
          <p role="alert" className="text-xs font-medium text-red-800">
            {chatError}
          </p>
        )}
      </div>

      {/* Chat Input Form */}
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-1.5">
        <div className="flex gap-2">
          <label htmlFor="copilot-input" className="sr-only">
            Ask VayuPariwar a question
          </label>
          <input
            id="copilot-input"
            type="text"
            maxLength={300}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about outdoor walks, kids, masks, or ventilation..."
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/20 focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={chatLoading || input.trim().length === 0}
            className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 focus-visible:outline-none disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Ask</span>
          </button>
        </div>
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>Grounded in live station data &middot; Non-medical guidance</span>
          <span>{input.length}/300</span>
        </div>
      </form>
    </section>
  );
}
