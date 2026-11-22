# VayuPariwar — GenAI Urban Air Quality Assistant for Indian Families

**VayuPariwar** is a Next.js 15 + TypeScript + Gemini 2.5 Flash application built for **PromptWars Virtual Challenge 06**. It combines **real-time Indian air quality data**, a **pure deterministic exposure & emission engine**, and **schema-constrained GenAI guidance** so multi-generational Indian households know *when* to step out, *what* daily choices matter most, and *how* to protect their home and family.

---

## Architecture Overview

VayuPariwar uses a **Hybrid Deterministic + GenAI Architecture** — zero LLM hallucinations on safety-critical numbers:

```text
[Next.js 15 Client UI (React + Tailwind CSS + Recharts)]
        │
        ├── GET  /api/aqi?city=delhi&lat=...&lon=...
        │         └── 15-min In-Memory TTL Cache (rounded lat/lon)
        │              ├── Primary: WAQI (Live CPCB Ground Stations)
        │              ├── Forecast & Automatic Fallback: Open-Meteo Air Quality API
        │              └── Pure Deterministic Engine:
        │                   ├── naqi.ts (Official CPCB NAQI Breakpoints)
        │                   └── safeWindow.ts (3-Hour Waking-Hours Sliding Window)
        │
        ├── Client-Side Instant Simulator
        │         └── smogShift.ts (Deterministic PM2.5 Reduction % & India CO2 kg/day)
        │
        ├── POST /api/plan
        │         └── Zod Validation + IP Rate Limiter (20 req/min)
        │         └── 30-min Server Cache (city + aqiCategory + profileHash)
        │         └── Gemini 2.5 Flash (Strict JSON responseSchema)
        │
        ├── POST /api/briefing
        │         └── Zod Validation + IP Rate Limiter
        │         └── Gemini 2.5 Flash (English / Hindi WhatsApp Briefing)
        │
        └── POST /api/chat
                  └── Zod Validation + Input Sanitization (<=300 chars) + IP Rate Limiter
                  └── Gemini 2.5 Flash (Context-Grounded Copilot & SmogShift Explainer)
```

---

## Prompt-Flow & Grounding Strategy

1. **Deterministic First:** Before any prompt is sent to Gemini, `src/lib/engine/` computes exact CPCB NAQI scores, primary pollutant, 3-hour Safe Window (`06:00–21:00`), peak inversion hours, and SmogShift PM2.5/CO2 impacts.
2. **Strict Grounding & Safety Guardrails:** System instructions (`src/lib/ai/prompts.ts`) are passed via `@google/genai`'s `systemInstruction` parameter and strictly forbid fabricating AQI numbers or giving medical prescriptions.
3. **Guaranteed JSON Structure:** `/api/plan`, `/api/briefing`, and `/api/chat` enforce Gemini `responseMimeType: "application/json"` with explicit `responseSchema` definitions, followed by runtime Zod verification.
4. **Prompt Injection Defense:** Free-text queries in `/api/chat` are sanitized (`sanitizeUserText`) to strip control tokens and injection delimiters and capped at 300 characters.

---

## Key Features & How the Solution Works (Challenge 06 Alignment)

1. **Real-Time Data (Zero Dummy Data):** Persistent Top Context Bar with 8 major Indian cities (Delhi, Pune, Mumbai, Bengaluru, Kolkata, Lucknow, Gurugram, Noida) + browser geolocation, displaying the live CPCB/WAQI station name, Indian NAQI score, primary pollutant (with matching concentration & unit), measurement timestamp, and an explicit `Fallback: Open-Meteo Model` badge whenever ground stations are unavailable.
2. **Low-Emission Daily Routines:** 24-hour Recharts hourly PM2.5 Safe-Window timeline highlighting the cleanest 3-hour waking window (`06:00–21:00`) vs. peak smog hours, paired with timing-aware commute/errand swaps and Morning/Afternoon/Evening action cards.
3. **Indoor Air Quality Hacks (Home Shield):** Budget-aware indoor air protection cards (`Zero-Cost`, `Low-Cost`, `Device`) tailored to whether the household owns a HEPA purifier, their kitchen setup (`Gas (No Chimney)`, `Gas + Chimney`, `Induction`), and flat exposure (`Roadside / Low` vs. `High-Rise`).
4. **Personalization & Direct Impact:** Multi-generational household profiles (`Daily Commuter`, `Young Children`, `Senior Citizens`, `Respiratory Sensitivity`), instant client-side **SmogShift** PM2.5 inhalation reduction (%) & India-specific CO2 avoided (kg/day) meters with grounded AI explanations, and one-click English / Hindi (Devanagari) WhatsApp family briefings + Family Air Copilot.

---

## Assumptions Made

- **CPCB NAQI Breakpoints:** Implemented as continuous linear interpolation across official CPCB bands (`0–50` Good, `51–100` Satisfactory, `101–200` Moderate, `201–300` Poor, `301–400` Very Poor, `401–500` Severe) with no decimal gaps and a hard cap at `500` for extreme winter smog.
- **Pollutant Unit Normalization:** WAQI PM2.5/PM10 US-EPA sub-indices are converted to `µg/m³` mass concentrations; Open-Meteo CO (`µg/m³`) is divided by `1000` to `mg/m³`. Gaseous pollutants (`NO2`, `O3`, `CO`) rely on Open-Meteo mass concentrations to avoid unit mixing.
- **India Transport Emission Factors:** SmogShift uses MoEFCC / India GHG Program urban benchmarks (`solo_car: 0.17`, `carpool: 0.06`, `two_wheeler: 0.05`, `metro_bus: 0.02`, `wfh: 0.00` kg CO2/passenger-km) and caps combined PM2.5 inhalation reduction at `95%`.
- **Truthful Fallback & Degradation:** When WAQI is missing, stale (`>3h`), or errors, `/api/aqi` falls back to Open-Meteo and badges `Fallback: Open-Meteo Model`. When both fail, `/api/aqi` returns HTTP `503` with a Retry UI—never fabricated AQI values.
- **Non-Medical Guidance:** Gemini system instructions strictly prohibit medical diagnoses or prescriptions.

---

## Live Deployment & Demo

- **Live Deployed URL:** *Pending final Vercel deployment*
- **Demo Video Link:** *Pending final walkthrough recording*

---

## Documentation

- [Product Architecture](docs/product_architecture.md)
- [Technical Architecture](docs/technical_architecture.md)
- [Testing Guide](TESTING.md)
- [Security Policy](SECURITY.md)
- [Contributing Guidelines](CONTRIBUTING.md)

---

## Tech Stack

- **Framework & Language:** Next.js 15 (App Router), React 19, TypeScript (`strict: true`)
- **Styling & Visualization:** Tailwind CSS 4, Recharts, Lucide Icons
- **GenAI & Validation:** `@google/genai` (Gemini 2.5 Flash with `responseSchema` & `systemInstruction`), Zod
- **Live Data Sources:** WAQI (Indian CPCB ground stations) + Open-Meteo Air Quality API (24h forecast & automatic fallback)
- **Testing & CI:** Vitest, React Testing Library, GitHub Actions

---

## Security & Accessibility Standards

- **Zero Client-Side Secrets:** `GEMINI_API_KEY` and `WAQI_TOKEN` are accessed strictly inside server-side Next.js Route Handlers.
- **Security Headers:** Configured in `next.config.ts` (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Content-Security-Policy`).
- **Rate Limiting & Validation:** Zod validation on every `GET` query and `POST` body; in-memory IP rate limiting (20 AI requests/min) returning HTTP 429 + `Retry-After` on all GenAI routes.
- **WCAG 2.1 AA:** Semantic landmarks (`<header>`, `<nav>`, `<main>`, `<section>`), logical heading hierarchy (`h1` → `h2` → `h3`), color + icon + text severity labels, native `<button>` controls with `aria-pressed` / `aria-expanded` / `focus-visible:ring`, full keyboard `role="tab"` navigation, and `aria-live="polite"` dynamic regions.

---

## Local Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Fill in `GEMINI_API_KEY` (from Google AI Studio) and optionally `WAQI_TOKEN` (from aqicn.org; if omitted, `/api/aqi` automatically falls back to Open-Meteo with a truthful fallback badge).

3. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

4. **Verify lint, typecheck, tests, and production build:**
   ```bash
   npm run lint
   npx tsc --noEmit
   npm test
   npm run build
   ```
