# MarketPulse

"Know what changed. Know what matters."

An attention engine for market watchlists — built for Code, by Groww.

## Repo layout

```
marketpulse/
  backend/     Node.js + Express API, PostgreSQL schema, service skeletons
  frontend/    React + Vite + TypeScript + Tailwind, light/dark theme system
```

## Build phases

- **Phase 1 (this delivery):** Project scaffold. DB schema. Backend service
  skeletons with mock data. Frontend shell with theme system, design tokens,
  and the "What changed?" dashboard wired to mock data. No live market-data
  integration yet, no auth yet.
- **Phase 2 (next):** Real database wiring (Supabase/Postgres), auth, watchlist
  CRUD end-to-end.
- **Phase 3:** Market-data provider integration + caching layer.
- **Phase 4:** Change Detection Engine + Attention Ranking Engine (real signals).
- **Phase 5:** Explanation service (AI-assisted, optional), reliability/freshness
  polish, deploy.

See each phase's section below as it's delivered.

---

## Phase 1 — what was built

**Backend (`/backend`)**
- Express app skeleton with health/readiness routes.
- Service-layer folders matching the architecture doc (watchlist, market data,
  snapshot, change detection, attention ranking, explanation, reliability) —
  each has a working stub returning mock data so the frontend has something
  real to call.
- PostgreSQL schema migration (`src/db/migrations/001_init.sql`) covering
  Users, Watchlists, Watchlist Stocks, Market Snapshots, Change Signals, Stock
  Metadata, Market Data Cache, User Preferences.
- `.env.example` — no secrets committed.

**Frontend (`/frontend`)**
- Vite + React + TypeScript + Tailwind.
- Design tokens for light/dark modes (Groww-inspired, not copied — see
  `frontend/src/styles/tokens.css`).
- Theme context + toggle, persisted to localStorage.
- Dashboard shell: "What changed since you last checked?" header, three
  attention tiers (Significant / Worth Watching / Normal), a stock card with
  freshness badge (LIVE/RECENT/DELAYED/STALE/UNAVAILABLE) and a "why flagged"
  explanation line — all rendered from mock data in
  `frontend/src/mocks/mockData.ts`.
- Empty state and API-unavailable state components (shown via a toggle for
  now, since there's no real backend call yet).

## How to run Phase 1

**Backend**
```bash
cd backend
npm install
cp .env.example .env
npm run dev
# → http://localhost:4000/api/health
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

## What to verify in Phase 1

1. `GET http://localhost:4000/api/health` returns `{ status: "ok" }`.
2. `GET http://localhost:4000/api/watchlist/mock` returns a mock watchlist
   with attention scores and freshness metadata.
3. Frontend loads the dashboard with three attention sections populated from
   mock data.
4. Theme toggle switches light ↔ dark, persists on refresh, and every surface
   (navbar, cards, badges, buttons) restyles consistently — no unstyled
   flashes.
5. Resize to mobile width — layout stays usable, no horizontal scroll.
6. Toggle the "simulate API failure" control (top right, dev-only) and
   confirm the UI shows an honest "data unavailable" state rather than stale
   numbers.

Once you've checked these, say go and I'll move to Phase 2 (real DB + auth +
watchlist CRUD).
