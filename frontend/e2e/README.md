# SAHARA Playwright E2E

Local browser tests for the Vite frontend against a local API. Gemini-backed routes are mocked in tests; studio export stays real so downloads can be validated.

## Prerequisites

1. **Frontend** — `npm run dev` in `frontend` (default `http://127.0.0.1:5173`).
2. **API + Mongo** — from `backend`:
   ```bash
   npm run dev:local
   ```
   This starts MongoMemoryServer (WiredTiger under `backend/data/mongo`) and the Express API on port `4000` via `node --import tsx scripts/serve-local.mjs`.
3. **Env (backend `.env`)** — required locally, never commit secrets:
   - `MONGODB_URI` — rewritten by `dev:local` to the memory server URI
   - `JWT_SECRET` (or equivalent auth secret used by the app)
   - `GEMINI_API_KEY` / `GEMINI_MODEL` — probed at serve-local startup; E2E mocks still block browser AI calls
   - `PORT=4000`, `NODE_ENV=development`
4. **Browsers** — once: `npx playwright install chromium`

Optional overrides: `E2E_BASE_URL`, `E2E_API_URL`.

## Commands

```bash
npm run test:e2e            # desktop + mobile public
npm run test:e2e:desktop    # chromium desktop only
```

Payments stay disabled (`paymentsConfigured: false`); premium checkout must remain non-live in these tests.

## Scope notes

- Live deployment is **not** covered by these results.
- Do not point E2E at production or burn production Gemini quota for chat/studio/images.
