# VayuPariwar — Technical Architecture

## 1. System Architecture Overview
VayuPariwar uses a **Hybrid Deterministic + GenAI Architecture**:
* **Deterministic TypeScript Engine** handles all safety-critical and quantitative logic: Indian NAQI calculation, 3-hour Safe-Window detection, and SmogShift $\text{PM}_{2.5}$/$\text{CO}_2$ math. Zero LLM hallucinations on numbers.
* **Probabilistic GenAI Layer (Gemini 2.5 Flash)** handles synthesis, household personalization, indoor hacks, and empathetic multilingual communication, constrained by strict JSON schemas.

```text
[Next.js Client UI (React + Tailwind + Recharts)]
        │
        ├── GET  /api/aqi?city=pune&lat=...&lon=...
        │         └── Server Cache (15 min TTL) + IP Rate Limiter (60 req/min)
        │              ├── Primary: WAQI (Live Indian CPCB Stations)
        │              └── Secondary/Forecast: Open-Meteo Air Quality API
        │              └── Deterministic Engine: Indian NAQI + Safe-Window Ranker
        │
        ├── POST /api/plan
        │         └── Zod Validation + IP Rate Limiter
        │         └── Server Cache (keyed by city + aqiCategory + profileHash)
        │         └── Gemini 2.5 Flash (Strict JSON responseSchema)
        │
        ├── POST /api/briefing
        │         └── Zod Validation + Gemini 2.5 Flash (EN / HI WhatsApp Text)
        │
        └── POST /api/chat
                  └── Zod Validation + Context-Grounded Gemini 2.5 Flash
```

---

## 2. Tech Stack
| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Framework** | **Next.js 15 (App Router) + TypeScript (`strict: true`)** | Keeps all API keys server-side; clean Vercel deployment. |
| **Styling & Charts** | **Tailwind CSS + Lucide Icons + Recharts** | Accessible, responsive UI with clean 24-hour bar chart. |
| **GenAI SDK** | **`@google/genai` (`gemini-2.5-flash`)** | Low latency, native `responseSchema` for guaranteed JSON, generous free tier. |
| **Validation** | **Zod** | Strict runtime validation for API requests, external API responses, and LLM outputs. |
| **Testing** | **Vitest + React Testing Library** | Fast unit & component tests for PromptWars automated code audit. |
| **CI/CD** | **GitHub Actions + Vercel** | Automated `lint`, `typecheck`, and `test` on every push. |

---

## 3. Real-Time Data Layer & Fallback Strategy
All external API calls execute strictly inside Next.js Route Handlers (`src/app/api/aqi/route.ts`).

1. **Primary Source (Current Ground Station):**
   * Query **WAQI API** (aggregates live **CPCB** stations across India) using city coordinates.
   * Extract `pm25` and `pm10` (converted from US-EPA sub-indices to `µg/m³`), `stationName`, and `measuredAt`. Gaseous pollutants (`no2`, `o3`, `co`) are sourced from Open-Meteo mass concentrations to avoid unit mixing.
2. **Hourly Forecast & Automatic Fallback:**
   * Query **Open-Meteo Air Quality API** (free, no key) for the 24-hour hourly `pm2_5` and `pm10` forecast at `(lat, lon)`.
   * If the primary ground station times out, errors, or returns stale data (>3 hours), automatically fall back to Open-Meteo current readings and set `sourceType: "fallback_model"` so the UI renders a truthful status badge.
3. **Caching:**
   * Cache `/api/aqi` responses per `(lat, lon)` rounded to 2 decimal places for **15 minutes** (`900s`) using an in-memory TTL cache.

---

## 4. Deterministic Calculation Engine (`src/lib/engine/`)
All quantitative logic is implemented as pure, side-effect-free TypeScript functions with comprehensive unit tests:

* **`naqi.ts` (Indian National AQI Calculator):**
  * Implements official CPCB sub-index breakpoint tables for $\text{PM}_{2.5}$, $\text{PM}_{10}$, $\text{NO}_2$, $\text{O}_3$, and $\text{CO}$.
  * Returns `{ aqi: number, category: 'Good' | 'Satisfactory' | 'Moderate' | 'Poor' | 'Very Poor' | 'Severe', primaryPollutant: string }`.
* **`safeWindow.ts` (Safe-Window Detector):**
  * Scans the 24-hour hourly $\text{PM}_{2.5}$ array using a **3-hour sliding window**.
  * Identifies `bestWindow` (lowest average $\text{PM}_{2.5}$ during waking hours 06:00–21:00) and `peakWindow` (highest average $\text{PM}_{2.5}$), plus the percentage reduction between them.
* **`smogShift.ts` (Interactive Impact Simulator):**
  * Inputs: `(currentPm25, safeWindowPm25, activeToggles, commuteDistanceKm)`.
  * Outputs:
    * **$\text{PM}_{2.5}$ Exposure Reduction (%):** Combines N95 filtration (~85–90% outdoor reduction), shifting outdoor exertion from peak to safe-window $\text{PM}_{2.5}$, and indoor source control (exhaust + no incense).
    * **Daily $\text{CO}_2$ Avoided (kg):** Uses India-specific emission factors (Petrol Car $\approx 0.17\text{ kg CO}_2/\text{km}$, 2-Wheeler $\approx 0.05\text{ kg CO}_2/\text{km}$, Metro/Bus $\approx 0.02\text{ kg CO}_2/\text{km}$).
  * Runs **client-side** for zero-latency toggle feedback and is passed to Gemini for the plain-English explanation.

---

## 5. GenAI Orchestration & Prompt Engineering (`src/lib/ai/`)
* **Strict Grounding:** Every prompt injects the verified JSON from `/api/aqi` and `smogShift.ts`. System instructions explicitly forbid inventing AQI numbers or giving unverified medical prescriptions.
* **Structured Output (`responseSchema`):** `/api/plan` enforces a strict JSON schema:
  ```json
  {
    "headline": "string",
    "memberPlans": [
      { "role": "string", "morning": "string", "afternoon": "string", "evening": "string" }
    ],
    "homeShieldHacks": [
      { "title": "string", "action": "string", "costTier": "Zero-Cost | Low-Cost | Device", "whyItWorks": "string" }
    ],
    "impactSummary": "string"
  }
  ```
* **Token Efficiency & Caching:** Cache `/api/plan` responses in memory for 30 minutes keyed by `${city}_${aqiCategory}_${profileHash}` to keep latency low and protect API credits during judging.
* **Prompt Injection Defense:** Sanitize all free-text inputs in `/api/chat` (max 300 chars, strip control tokens) and separate system instructions from user messages via the SDK's `systemInstruction` parameter.

---

## 6. Repository Structure
```text
vayupariwar/
├── .github/workflows/ci.yml       # Runs lint, tsc --noEmit, npm test, npm run build
├── docs/
│   ├── product_architecture.md
│   └── technical_architecture.md
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── aqi/route.ts       # Live CPCB/WAQI + Open-Meteo fallback
│   │   │   ├── plan/route.ts      # Structured Gemini family plan
│   │   │   ├── briefing/route.ts  # EN/HI WhatsApp briefing generator
│   │   │   └── chat/route.ts      # Context-grounded follow-up copilot
│   │   ├── layout.tsx             # Semantic landmarks + metadata
│   │   └── page.tsx               # Main 3-tab shell
│   ├── components/
│   │   ├── TopContextBar.tsx      # City selector, truthful AQI badge, profile pills
│   │   ├── SafeWindowChart.tsx    # Recharts 24h timeline
│   │   ├── FamilyPlanTab.tsx      # Role cards + Home Shield hacks
│   │   ├── SmogShiftTab.tsx       # Interactive toggles + impact meters
│   │   └── BriefingChatTab.tsx    # WhatsApp card + Copilot drawer
│   ├── lib/
│   │   ├── aqi/                   # External API clients + TTL cache
│   │   ├── engine/                # Pure deterministic math (naqi, safeWindow, smogShift)
│   │   ├── ai/                    # Gemini client, prompts, responseSchemas
│   │   └── validation/            # Zod schemas + IP rate limiter
│   └── types/                     # Shared TypeScript interfaces
├── tests/
│   ├── engine/                    # Unit tests for NAQI, SafeWindow, SmogShift
│   ├── api/                       # Fallback & Zod validation tests
│   └── components/                # Accessibility & rendering tests
├── next.config.ts                 # Security headers (CSP, X-Frame-Options)
├── .env.example                   # Documented env vars (no real keys)
└── README.md                      # Architecture diagram, prompt flow, setup
```

---

## 7. Coding Standards & PromptWars Audit Compliance
* **Security:**
  * Zero client-side API keys (`GEMINI_API_KEY`, `WAQI_TOKEN` strictly server-side).
  * Zod validation on every `POST` body and `GET` query param.
  * In-memory IP rate limiting (20 AI requests/min) on `/api/plan`, `/api/briefing`, and `/api/chat`.
  * Security headers in `next.config.ts` (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy`, and `Cache-Control: no-store` on `/api/*`).
* **Code Quality:**
  * TypeScript `strict: true`, ESLint (`next/core-web-vitals` + `next/typescript`), zero `any` types, explicit structured error handling.
* **Testing:**
  * Minimum 15+ unit/component tests covering CPCB NAQI edge cases, API fallback triggering, SmogShift math, and UI accessibility roles.
* **Accessibility:**
  * Native `<button>` elements with `aria-pressed` / `role="tab"`, `aria-selected`, `aria-live="polite"`, and WCAG AA color contrast.