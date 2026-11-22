# Changelog

All notable changes to **VayuPariwar** are documented in this file.

## [1.0.0] - 2026-11-22
### Added
- Live Indian air quality data pipeline (`GET /api/aqi`) with WAQI (CPCB) primary source, Open-Meteo 24h forecast & automatic fallback, 15-minute coordinate-rounded TTL cache, 5-second `AbortController` timeout, and bounded IP rate limiting.
- Pure deterministic engines (`src/lib/engine/`): CPCB NAQI calculator (`naqi.ts`), 3-hour waking-hours Safe-Window detector (`safeWindow.ts`), and SmogShift PM2.5/CO2 simulator (`smogShift.ts`).
- Schema-constrained Gemini 2.5 Flash routes (`POST /api/plan`, `POST /api/briefing`, `POST /api/chat`) with Zod validation, 30-minute normalized plan cache, EN/HI WhatsApp briefings, and bounded IP rate limiting.
- WCAG 2.1 AA accessible 3-tab UI with skip-to-content link, keyboard tablist navigation, color+icon+text severity badges, `aria-live="polite"` announcements, and `prefers-reduced-motion` support.
- Automated Vitest + React Testing Library suite and GitHub Actions CI pipeline.
