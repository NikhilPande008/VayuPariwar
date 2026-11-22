# Testing Guide

VayuPariwar uses **Vitest** and **React Testing Library** to verify deterministic math, API route resilience, Gemini orchestration, and WCAG 2.1 AA UI behavior.

## Running Tests
```bash
npm test              # Run full suite once
npm run test:watch    # Watch mode during development
```

## Test Suites
- `tests/engine/naqi.test.ts` — All 6 CPCB NAQI categories, continuous decimal boundaries, CO `µg/m³ → mg/m³` conversion, Severe 500 cap, flaky sensor sanitization, and `dataCompleteness`.
- `tests/engine/safeWindow.test.ts` — 3-hour waking-hours sliding window, flat curves, partial/incomplete arrays, and invalid slot handling.
- `tests/engine/smogShift.test.ts` — Zero-toggle baseline, India CO2 emission factors, monotonicity, 0–95% bounds, and RangeError guards.
- `tests/api/aqi.test.ts` — Zod 400 rejections, 5s `AbortController` timeout, 15-min caching, automatic Open-Meteo fallback, 503 truthful error, and bounded IP rate limiting.
- `tests/api/aiRoutes.test.ts` — Zod validation, normalized 30-min `/api/plan` caching, EN/HI briefings, 300-char chat sanitization, and HTTP 429 + `Retry-After` rate limiting across `/api/plan`, `/api/briefing`, and `/api/chat`.
- `tests/ai/gemini.test.ts` — `GeminiConfigError`, `classifyGeminiError`, `withTimeout`, `parseJsonSafely`, and SDK response schema validation.
- `tests/components/ui.test.tsx` — Truthful AQI/primary pollutant badges, household profile pills, instant SmogShift meters, clipboard fallback + `aria-live`, `AbortController` race-condition cancellation, Retry recovery, and keyboard tablist navigation.
