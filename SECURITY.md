# Security Policy

## Secret Management
- `GEMINI_API_KEY` and `WAQI_TOKEN` are strictly server-side environment variables accessed only inside Next.js Route Handlers and server modules.
- Never prefix API keys with `NEXT_PUBLIC_` or commit `.env.local`.

## Defenses Implemented
- **Input Validation:** Strict Zod schemas on `/api/aqi`, `/api/plan`, `/api/briefing`, and `/api/chat` returning HTTP `400` on malformed payloads.
- **Rate Limiting:** Bounded in-memory sliding-window IP rate limiters (`20 req/min` on AI routes, `60 req/min` on `/api/aqi`) returning HTTP `429` with `Retry-After`.
- **Prompt Injection Defense:** Chat input sanitization (`sanitizeUserText`, `<=300` chars) and strict separation of system prompts via Gemini's `systemInstruction`.
- **HTTP Security Headers:** Configured in `next.config.ts` (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy`, and `Cache-Control: no-store` on `/api/*`).

## Reporting a Vulnerability
Please open a private security advisory or contact the repository maintainers directly rather than filing a public issue with exploit details.
