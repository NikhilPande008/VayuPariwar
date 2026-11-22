# Contributing to VayuPariwar

Thank you for contributing to **VayuPariwar**.

## Development Workflow
1. Copy `.env.example` to `.env.local` and configure `GEMINI_API_KEY` (and optionally `WAQI_TOKEN`). Never commit `.env.local`.
2. Keep deterministic math pure inside `src/lib/engine/`, external API clients inside `src/lib/aqi/`, Gemini orchestration inside `src/lib/ai/`, and Zod schemas/rate limiting inside `src/lib/validation/`.
3. Maintain TypeScript `strict: true` with zero `any`, zero `@ts-ignore`/`@ts-expect-error`, and file-level JSDoc comments on all `src/` files.
4. Run all verification gates before opening a pull request:
   ```bash
   npm run lint
   npx tsc --noEmit
   npm test
   npm run build
   ```
