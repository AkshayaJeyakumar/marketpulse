# MarketPulse: Technical Specification & Repository Audit

> **Audit Context**: Analyzed repository `c:\projects\marketpulse` across frontend, backend, database schema, configurations, and data flow pipelines.

---

## A. PROJECT OVERVIEW

### What the Project Does
**MarketPulse** is an **attention engine for stock market watchlists**, developed for *Code, by Groww*. Rather than simply listing prices or acting as a trading/buy-sell advisory system, MarketPulse:
1. Compares current market conditions against the user’s **last acknowledged view**.
2. Computes independent signals for price movement, trading volume shift, and intraday volatility.
3. Ranks stocks into product attention tiers (**Significant**, **Worth Watching**, **Normal**) to reduce information overload.
4. Generates **explainable, plain-language observation summaries** describing *why* a stock was flagged without making financial predictions.
5. Monitors data freshness and exchange status (identifying live, recent, delayed, stale, or market-closed states).

### Who It Is For
Retail stock market investors and traders who maintain personal watchlists and need to quickly answer: *"What changed since I last checked?"* and *"Which changes actually matter?"*

### Main User Flow
1. **Authentication**: Unauthenticated users visiting the app are directed to `/login` or `/register` (`AuthPage.tsx`). Credentials are authenticated via `POST /api/auth/login` or `POST /api/auth/register`. Upon success, a 32-byte session token is generated and stored in `localStorage` as `marketpulse.auth.token`.
2. **Dashboard Load**: Authenticated users load `Dashboard.tsx`. The custom hook `useWatchlist.ts` issues a `GET /api/watchlist` request.
3. **Data Fetching & Signal Computation**: Backend fetches the user's saved watchlist ('My Watchlist'), retrieves the last acknowledged snapshot from `market_snapshots`, fetches real-time quotes from Yahoo Finance Chart API (`marketDataService.getQuote`), runs the `changeDetectionEngine`, ranks attention using `attentionRankingEngine`, and generates explanations using `explanationService`.
4. **View Acknowledgement**: When `Dashboard.tsx` finishes rendering the loaded data, it automatically fires `acknowledgeView()`, issuing `POST /api/watchlist/view` to record current price/volume snapshots into PostgreSQL as the new baseline for the *next* visit.
5. **Interactive Exploration**:
   - **Filter & Search**: Users can search watchlist items locally in `Navbar.tsx`.
   - **Add Stocks**: Clicking "+ Add stock" opens `AddStockModal.tsx`, querying the backend instrument search endpoint (`GET /api/instruments/search?q=...`), which searches Upstox's Indian equity master universe.
   - **Remove Stocks**: Clicking "Remove" opens `ConfirmationModal.tsx` and issues `DELETE /api/watchlist/stocks/:symbol`.
   - **Stock Details & Charts**: Clicking any stock card/row opens `StockDetail.tsx`, fetching historical price points (`GET /api/market/history/:symbol?range=1d|1w|1m`) rendered via `Recharts`.
   - **Personalized Recommendations**: `RecommendationSection.tsx` fetches sector-matched suggestions (`GET /api/recommendations/watchlist`), allowing 1-click addition or dismissal ("Not interested").

### Tech Stack Used
* **Frontend**: React 19 (`react`, `react-dom`), TypeScript 6, Vite 8, TailwindCSS v4 (`@tailwindcss/vite`), Recharts 3 (`recharts`), Oxlint (`oxlint`).
* **Backend**: Node.js (ES Modules, `"type": "module"`), Express 4 (`express`), PostgreSQL driver (`pg`), `cors`, `dotenv`.
* **Data Providers & Services**: Yahoo Finance Chart API (`query1.finance.yahoo.com`), Upstox GZipped Instrument Master (`assets.upstox.com`), Node Native Crypto (`node:crypto`), Node Zlib (`node:zlib`).
* **Deployment & Tooling**: Vercel SPA rewrites (`vercel.json`), Supabase / PostgreSQL.

### Application Architecture
**Full-Stack Application** (React Vite SPA + Express REST API + PostgreSQL Database).

---

## B. COMPLETE FILE-BY-FILE EXPLANATION

### 1. Root & Documentation Files
* **[README.md](file:///c:/projects/marketpulse/README.md)**: Product documentation detailing MarketPulse’s core problem statement, solution, key features (Smart Watchlist, "What Changed?" Dashboard, Change Engine), and default weighting scheme (Price 50%, Volume 30%, Volatility 20%).
* **[frontend/README.md](file:///c:/projects/marketpulse/frontend/README.md)**: Frontend setup documentation detailing Vite, SWC/Oxc compiler plugins, and Oxlint configuration rules.

### 2. Configuration & Manifests
* **[backend/package.json](file:///c:/projects/marketpulse/backend/package.json)**: Node backend package configuration. Defines ES module resolution (`"type": "module"`), dev script (`node --watch src/server.js`), and dependencies: `@bshada/nseapi`, `cors`, `dotenv`, `express`, `nse-bse-api`, `pg`.
* **[frontend/package.json](file:///c:/projects/marketpulse/frontend/package.json)**: React SPA package configuration. Defines scripts (`dev`, `build`, `lint`, `preview`), dependencies (`react`, `react-dom`, `recharts`), and devDependencies (`vite`, `@tailwindcss/vite`, `typescript`, `oxlint`, `@types/node`).
* **[backend/.env.example](file:///c:/projects/marketpulse/backend/.env.example)**: Environment variable template file defining `PORT`, `NODE_ENV`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTOX_API_KEY`, `UPSTOX_API_SECRET`, `UPSTOX_REDIRECT_URI`, and `ANTHROPIC_API_KEY`.
* **[frontend/vite.config.ts](file:///c:/projects/marketpulse/frontend/vite.config.ts)**: Vite build configuration loading `@vitejs/plugin-react` and `@tailwindcss/vite`.
* **[frontend/vercel.json](file:///c:/projects/marketpulse/frontend/vercel.json)**: Vercel routing configuration setting up a SPA wildcard rewrite (`/(.*) -> /index.html`).
* **[frontend/tsconfig.json](file:///c:/projects/marketpulse/frontend/tsconfig.json)**, **[tsconfig.app.json](file:///c:/projects/marketpulse/frontend/tsconfig.app.json)**, **[tsconfig.node.json](file:///c:/projects/marketpulse/frontend/tsconfig.node.json)**: TypeScript compiler configuration files setup for project references and DOM types.

### 3. Backend Architecture & Database Files
* **[backend/src/server.js](file:///c:/projects/marketpulse/backend/src/server.js)**: Server bootstrap file. Verifies database connectivity using `checkDatabaseConnection()`, instantiates the app via `createApp()`, and listens on `PORT` (default `4000`).
* **[backend/src/app.js](file:///c:/projects/marketpulse/backend/src/app.js)**: Express app instance creator. Sets CORS allowed origins (`http://localhost:5173`, `http://127.0.0.1:5173`, `process.env.FRONTEND_URL`), parses JSON, mounts routers (`/api/health`, `/api/auth`, `/api/watchlist`, `/api/recommendations`, `/api/instruments`, `/api/market`), and includes a global error handler mapping Postgres errors (`57P01`, `42703`) to `503 Service Unavailable`.
* **[backend/src/config/index.js](file:///c:/projects/marketpulse/backend/src/config/index.js)**: Configuration module exposing environment variables (`port`, `nodeEnv`, `databaseUrl`, `marketDataProvider`, `upstox`).
* **[backend/src/db/database.js](file:///c:/projects/marketpulse/backend/src/db/database.js)**: Central PostgreSQL pool initializer. Configures `pg.Pool` using `process.env.DATABASE_URL` with SSL (`rejectUnauthorized: false`). Exports `query()`, `checkDatabaseConnection()`, and `pool`.
* **[src/db/database.js](file:///c:/projects/marketpulse/src/db/database.js)** & **[backend/src/db/migrations/database.js](file:///c:/projects/marketpulse/backend/src/db/migrations/database.js)**: Duplicate database connector files located in root `src/db` and `migrations/` directories.
* **[backend/src/db/checkSchema.js](file:///c:/projects/marketpulse/backend/src/db/checkSchema.js)**: Debug script querying `information_schema.columns` for `stock_metadata`.
* **[backend/src/db/seedDemo.js](file:///c:/projects/marketpulse/backend/src/db/seedDemo.js)**: Script inserting initial demo user `demo@marketpulse.local` and default watchlist 'My Watchlist'.
* **[backend/src/db/seedStocks.js](file:///c:/projects/marketpulse/backend/src/db/seedStocks.js)**: Script seeding 8 initial Indian equities (`TCS`, `INFY`, `RELIANCE`, `TATAMOTORS`, `HDFCBANK`, `ITC`, `ZOMATO`, `ADANIENT`) into `stock_metadata`.
* **[backend/src/db/seedWatchlist.js](file:///c:/projects/marketpulse/backend/src/db/seedWatchlist.js)**: Script linking seeded stock symbols to the demo user's watchlist in `watchlist_stocks`.
* **[backend/checkSnapshots.js](file:///c:/projects/marketpulse/backend/checkSnapshots.js)**: CLI tool displaying recent rows in `market_snapshots` for `demo@marketpulse.local`.
* **[backend/testAlphaVantage.js](file:///c:/projects/marketpulse/backend/testAlphaVantage.js)**: Test script probing Alpha Vantage API for `.BSE` quotes.

### 4. SQL Migrations
* **[backend/src/db/migrations/001_init.sql](file:///c:/projects/marketpulse/backend/src/db/migrations/001_init.sql)**: Initial DB schema. Creates tables: `users`, `user_preferences`, `stock_metadata`, `watchlists`, `watchlist_stocks`, `market_data_cache`, `market_snapshots`, `change_signals`, `attention_thresholds`.
* **[backend/src/db/migrations/002_auth.sql](file:///c:/projects/marketpulse/backend/src/db/migrations/002_auth.sql)**: Auth migration. Adds `password_hash` column to `users` and creates `auth_sessions` table.
* **[backend/src/db/migrations/003_recommendations.sql](file:///c:/projects/marketpulse/backend/src/db/migrations/003_recommendations.sql)**: Recommendations migration. Creates `user_stock_interactions` table and seeds additional stocks (`WIPRO`, `HCLTECH`, `MARUTI`, etc.).

### 5. Backend Middleware & Routes
* **[backend/src/middleware/auth.js](file:///c:/projects/marketpulse/backend/src/middleware/auth.js)**: Authentication middleware `requireAuth`. Extracts Bearer token, validates active session using `getUserFromToken`, and populates `req.user`.
* **[backend/src/routes/auth.js](file:///c:/projects/marketpulse/backend/src/routes/auth.js)**: Endpoints for `POST /register`, `POST /login`, `GET /me`, `POST /logout`.
* **[backend/src/routes/health.js](file:///c:/projects/marketpulse/backend/src/routes/health.js)**: Endpoint `GET /` returning backend status and timestamp.
* **[backend/src/routes/instruments.js](file:///c:/projects/marketpulse/backend/src/routes/instruments.js)**: Endpoint `GET /search?q=...` invoking `searchInstruments()`.
* **[backend/src/routes/market.js](file:///c:/projects/marketpulse/backend/src/routes/market.js)**: Endpoint `GET /history/:symbol?range=1d|1w|1m` returning historical chart data via `getHistoricalPrices()`.
* **[backend/src/routes/recommendations.js](file:///c:/projects/marketpulse/backend/src/routes/recommendations.js)**: Endpoints `GET /watchlist` and `POST /watchlist/:symbol/not-interested`.
* **[backend/src/routes/watchlist.js](file:///c:/projects/marketpulse/backend/src/routes/watchlist.js)**: Endpoints `GET /`, `POST /view`, `POST /stocks`, and `DELETE /stocks/:symbol`.

### 6. Backend Core Business Logic Services
* **[backend/src/services/attentionRankingEngine.js](file:///c:/projects/marketpulse/backend/src/services/attentionRankingEngine.js)**: Function `rankAttention(signals, thresholds)`. Computes weighted attention score (`price * 0.5 + volume * 0.3 + volatility * 0.2`), clamps score between 0 and 100, and assigns tier: `significant` (>= 60), `worth_watching` (>= 25), `normal` (< 25).
* **[backend/src/services/authService.js](file:///c:/projects/marketpulse/backend/src/services/authService.js)**: User management. Hashes passwords using `scrypt` with a random salt (`hashPassword`), verifies passwords (`verifyPassword`), creates 30-day session tokens (`createSession`), and looks up tokens using SHA-256 (`hashToken`).
* **[backend/src/services/changeDetectionEngine.js](file:///c:/projects/marketpulse/backend/src/services/changeDetectionEngine.js)**: Deterministic signal calculator `computeSignals(previous, current)`. Calculates:
  - `priceSignal`: `clamp((abs(current.price - previous.price) / previous.price * 100 / 5) * 100, 0, 100)`
  - `volumeSignal`: `clamp((abs(current.volume - previous.volume) / previous.volume / 2) * 100, 0, 100)`
  - `volatilitySignal`: `clamp(((dayHigh - dayLow) / prevClose * 100 / 6) * 100, 0, 100)`
* **[backend/src/services/demoMarketDataService.js](file:///c:/projects/marketpulse/backend/src/services/demoMarketDataService.js)**: Generator `getDemoQuote(symbol)`. Generates simulated stock quotes using a 20-second 3-phase cycle (`getPhase()`) and symbol hash (`hashSymbol()`).
* **[backend/src/services/explanationService.js](file:///c:/projects/marketpulse/backend/src/services/explanationService.js)**: Converts signal values into non-financial plain language explanations (`explainSignals`), summary strings (`explainAttention`), and responsible use disclaimers (`buildExplanation`).
* **[backend/src/services/instrumentSearchService.js](file:///c:/projects/marketpulse/backend/src/services/instrumentSearchService.js)**: Download manager `loadInstruments()`. Fetches Upstox's gzipped instrument master file (`complete.json.gz`), unzips in memory using `node:zlib`, filters NSE/BSE equities, and searches matches (`searchInstruments`).
* **[backend/src/services/marketDataService.js](file:///c:/projects/marketpulse/backend/src/services/marketDataService.js)**: Real market data pipeline. Fetches current quotes (`getQuote`) and chart data (`getHistoricalPrices`) from Yahoo Finance (`query1.finance.yahoo.com/v8/finance/chart`). Handles symbol conversions (`ZOMATO` -> `ETERNAL.NS`, `TATAMOTORS` -> `TMCV.NS`) and normalizes timestamps to India Standard Time (IST).
* **[backend/src/services/recommendationService.js](file:///c:/projects/marketpulse/backend/src/services/recommendationService.js)**: Personalization engine (`getWatchlistRecommendations`). Finds watched sectors, queries unwatched equities in those sectors, excludes dismissed stocks in `user_stock_interactions`, and ranks recommendations by score (`watched_count * 50`).
* **[backend/src/services/reliabilityService.js](file:///c:/projects/marketpulse/backend/src/services/reliabilityService.js)**: Freshness classifier (`classifyFreshness`). Assigns freshness levels: `live` (<= 15s age), `recent` (<= 2m), `delayed` (<= 15m), `stale` (> 15m), or `unavailable`. Wraps fetch calls (`withReliability`) to prevent unhandled exceptions.
* **[backend/src/services/watchlistService.js](file:///c:/projects/marketpulse/backend/src/services/watchlistService.js)**: Main orchestrator. Computes `getWatchlistView(userId)` without modifying DB state. Saves baseline snapshot `saveCurrentWatchlistView(userId)` on user view acknowledgement. Manages watchlist additions and removals.

### 7. Frontend UI Framework & State
* **[frontend/src/main.tsx](file:///c:/projects/marketpulse/frontend/src/main.tsx)**: React root entry point mounting `<App />` within `<StrictMode>`.
* **[frontend/src/App.tsx](file:///c:/projects/marketpulse/frontend/src/App.tsx)**: Main application wrapper providing `AuthProvider` and `ThemeProvider`. Manages URL routing (`/login`, `/register`, `/dashboard`).
* **[frontend/src/index.css](file:///c:/projects/marketpulse/frontend/src/index.css)**: Global stylesheet importing TailwindCSS v4 and `./styles/tokens.css`.
* **[frontend/src/styles/tokens.css](file:///c:/projects/marketpulse/frontend/src/styles/tokens.css)**: CSS token design system defining color palettes, radii, typography, and shadows for both light mode (`:root`) and dark mode (`[data-theme="dark"]`).
* **[frontend/src/types/watchlist.ts](file:///c:/projects/marketpulse/frontend/src/types/watchlist.ts)**: TypeScript interfaces (`Tier`, `Freshness`, `Direction`, `WatchlistItem`, `WatchlistView`, `WatchlistRecommendation`).
* **[frontend/src/context/AuthContext.tsx](file:///c:/projects/marketpulse/frontend/src/context/AuthContext.tsx)**: React Auth Context. Reads token from `localStorage` (`marketpulse.auth.token`), authenticates with `/api/auth/me`, provides `login`, `register`, `logout`, and exports `authFetch` with automatic Bearer headers.
* **[frontend/src/context/ThemeContext.tsx](file:///c:/projects/marketpulse/frontend/src/context/ThemeContext.tsx)**: React Theme Context. Manages light/dark mode state synced to `document.documentElement` (`data-theme`) and `localStorage` (`marketpulse-theme`).
* **[frontend/src/hooks/useRecommendations.ts](file:///c:/projects/marketpulse/frontend/src/hooks/useRecommendations.ts)**: Hook fetching personalized stock recommendations from `/api/recommendations/watchlist`.
* **[frontend/src/hooks/useWatchlist.ts](file:///c:/projects/marketpulse/frontend/src/hooks/useWatchlist.ts)**: Hook fetching current watchlist state from `/api/watchlist` and exposing `acknowledgeView()`.

### 8. Frontend UI Components
* **[frontend/src/components/Navbar.tsx](file:///c:/projects/marketpulse/frontend/src/components/Navbar.tsx)**: Top bar with brand logo, tagline, user display name, logout button, watchlist search input, and `ThemeToggle`.
* **[frontend/src/components/Dashboard.tsx](file:///c:/projects/marketpulse/frontend/src/components/Dashboard.tsx)**: Main dashboard page. Displays header, "Last checked" banner, "Attention summary", tier sections (`TierSection`), recommendations (`RecommendationSection`), and modals. Automatically triggers `acknowledgeView()` on load.
* **[frontend/src/components/StockCard.tsx](file:///c:/projects/marketpulse/frontend/src/components/StockCard.tsx)**: Card for Significant & Worth Watching stocks displaying price, % change since last view, attention score bar, explanations, and detail page trigger.
* **[frontend/src/components/StockRow.tsx](file:///c:/projects/marketpulse/frontend/src/components/StockRow.tsx)**: Compact table row for Normal tier stocks with expandable "Why?" explanation drawer.
* **[frontend/src/components/StockDetail.tsx](file:///c:/projects/marketpulse/frontend/src/components/StockDetail.tsx)**: Detailed view for a selected stock featuring range selector buttons (`1D`, `1W`, `1M`), interactive Recharts line chart, metric cards, signal progress bars (`priceSignal`, `volumeSignal`, `volatilitySignal`), reasons, explanations, and data transparency metadata.
* **[frontend/src/components/AddStockModal.tsx](file:///c:/projects/marketpulse/frontend/src/components/AddStockModal.tsx)**: Search dialog modal with debounced input searching Upstox Indian equity master and adding stocks to user's watchlist.
* **[frontend/src/components/ConfirmationModal.tsx](file:///c:/projects/marketpulse/frontend/src/components/ConfirmationModal.tsx)**: Accessible modal dialog confirming stock removal.
* **[frontend/src/components/RecommendationSection.tsx](file:///c:/projects/marketpulse/frontend/src/components/RecommendationSection.tsx)**: UI grid displaying sector-based stock recommendations with "+ Add" and "Not interested" actions.
* **[frontend/src/components/FreshnessBadge.tsx](file:///c:/projects/marketpulse/frontend/src/components/FreshnessBadge.tsx)**: Badge showing market data freshness status. Computes live IST market open hours (09:15-15:30 IST Mon-Fri) to display "Market closed" when applicable.
* **[frontend/src/components/ThemeToggle.tsx](file:///c:/projects/marketpulse/frontend/src/components/ThemeToggle.tsx)**: Switch button toggling light and dark themes.
* **[frontend/src/components/TierSection.tsx](file:///c:/projects/marketpulse/frontend/src/components/TierSection.tsx)**: Section container for grouping stocks by attention tier.
* **[frontend/src/components/StatusStates.tsx](file:///c:/projects/marketpulse/frontend/src/components/StatusStates.tsx)**: Rendering components for `LoadingState`, `ErrorState`, and `EmptyWatchlistState`.
* **[frontend/src/components/AuthPage.tsx](file:///c:/projects/marketpulse/frontend/src/components/AuthPage.tsx)**: Authentication form component for user login and registration.

---

## C. CURRENT FEATURES ALREADY IMPLEMENTED

| Feature Name | Implementation File(s) | How It Works | Data Source | UI Location |
| :--- | :--- | :--- | :--- | :--- |
| **User Authentication & Session Management** | `authService.js`, `routes/auth.js`, `AuthContext.tsx`, `AuthPage.tsx` | `scrypt` password hashing with unique salt. Session tokens stored as SHA-256 hashes in `auth_sessions`. Bearer header auth in client. | PostgreSQL (`users`, `auth_sessions`) | `/login`, `/register` pages, Navbar Logout button |
| **Smart Watchlist Persistence** | `watchlistService.js`, `routes/watchlist.js`, `useWatchlist.ts` | Multi-user watchlists. Add stock (`POST /api/watchlist/stocks`), Remove stock (`DELETE /api/watchlist/stocks/:symbol`), Read (`GET /api/watchlist`). | PostgreSQL (`watchlists`, `watchlist_stocks`, `stock_metadata`) | Dashboard, Add Stock Modal, Confirmation Modal |
| **Dynamic Instrument Search** | `instrumentSearchService.js`, `routes/instruments.js`, `AddStockModal.tsx` | Downloads Upstox exchange instrument master `complete.json.gz` once, unzips in-memory using `zlib`, filters NSE/BSE equities, and performs fast client/server search. | Upstox CDN (`assets.upstox.com`) | Add Stock Modal |
| **Yahoo Finance Market Data Pipeline** | `marketDataService.js`, `reliabilityService.js` | Queries Yahoo Finance Chart endpoint (`query1.finance.yahoo.com`). Maps symbol tickers (`ZOMATO` -> `ETERNAL.NS`). Classifies freshness based on retrieval and exchange timestamps. | Yahoo Finance API | Dashboard, Stock Cards, Stock Detail |
| **"What Changed?" Baseline Snapshotting** | `watchlistService.js`, `Dashboard.tsx` | Diffing engine comparing current market state against user's last acknowledged snapshot in `market_snapshots`. Automatically saves baseline snapshot (`POST /api/watchlist/view`) upon dashboard load. | PostgreSQL (`market_snapshots`) | Dashboard "Last Checked" Banner, Stock Cards |
| **Change Signal & Anomaly Engine** | `changeDetectionEngine.js` | Computes independent 0-100 signals for price movement % since last view, volume change % since last view, and intraday range volatility %. | Market Data vs DB Snapshots | Stock Cards, Stock Detail, Stock Rows |
| **Attention Ranking Engine** | `attentionRankingEngine.js` | Computes weighted score (`50% price + 30% volume + 20% volatility`), clamps [0, 100], categorizes into `significant` (>=60), `worth_watching` (>=25), `normal` (<25). | Computed signals | Dashboard Tier Sections |
| **Explainable Non-Financial Signals** | `explanationService.js` | Translates signal values into plain-language bullet points and summary explanations without giving buy/sell trading advice. | Rule-based template engine | Stock Cards, Stock Detail, Stock Rows |
| **Market Data Freshness & IST Exchange Hours** | `reliabilityService.js`, `FreshnessBadge.tsx` | Classifies freshness (`live`, `recent`, `delayed`, `stale`, `unavailable`). Detects IST trading session (09:15–15:30 IST Mon-Fri) to display "Market closed" when appropriate. | Timestamps & Local Browser IST Time | Stock Cards, Stock Detail, Stock Rows |
| **Personalized Sector-Based Recommendations** | `recommendationService.js`, `routes/recommendations.js`, `RecommendationSection.tsx` | Identifies user's watched sectors, recommends top unwatched stocks in those sectors, supports dismissal ("Not interested") stored in DB. | PostgreSQL (`stock_metadata`, `user_stock_interactions`) | Dashboard "Suggested for you" Section |
| **Stock Detail & Interactive Price History Chart** | `marketDataService.js`, `StockDetail.tsx` | Fetches historical candle points for 1D (5m), 1W (15m), and 1M (1d) ranges. Displays interactive line chart using `Recharts`, signal breakdowns, and data transparency metadata. | Yahoo Finance Historical API | Stock Detail Page |
| **Design System & Theme Switcher** | `tokens.css`, `ThemeContext.tsx`, `ThemeToggle.tsx` | Modern CSS variables theme system supporting Light mode and Dark mode with reduced-motion accessibility support. | LocalStorage (`marketpulse-theme`) | Navbar Toggle |

---

## D. PARTIALLY IMPLEMENTED FEATURES

1. **Upstox Market Data Provider Integration**:
   - *Where*: `backend/.env.example`, `config/index.js`, `watchlistService.js`.
   - *What is missing*: `config/index.js` defines `config.upstox` and `backend/.env.example` has fields for `UPSTOX_API_KEY`, `UPSTOX_API_SECRET`, and `UPSTOX_REDIRECT_URI`. However, `watchlistService.js` explicitly throws an error if `config.marketDataProvider !== 'yahoo'`. No Upstox live streaming or quote fetching service is implemented.
2. **AI Explanation Service (Anthropic)**:
   - *Where*: `backend/.env.example`, `explanationService.js`.
   - *What is missing*: `backend/.env.example` includes `ANTHROPIC_API_KEY`. However, `explanationService.js` is entirely deterministic and rule-based. No LLM integration or Anthropic SDK call exists.
3. **User Preferences Persistence (`user_preferences` table)**:
   - *Where*: `001_init.sql`, `ThemeContext.tsx`.
   - *What is missing*: Migration `001_init.sql` creates a `user_preferences` table storing `theme` and `attention_sensitivity`. However, no backend API routes exist to query or update user preferences, and `ThemeContext.tsx` saves theme preferences solely to browser `localStorage`.
4. **Change Signal Database Logging (`change_signals` table)**:
   - *Where*: `001_init.sql`, `watchlistService.js`.
   - *What is missing*: `001_init.sql` defines the `change_signals` table to store calculated scores, tiers, and reasons for auditability. However, `saveCurrentWatchlistView` in `watchlistService.js` only writes snapshot prices to `market_snapshots` and never populates `change_signals`.
5. **Configurable Attention Thresholds (`attention_thresholds` table)**:
   - *Where*: `001_init.sql`, `attentionRankingEngine.js`.
   - *What is missing*: `001_init.sql` creates an `attention_thresholds` table (defaulting to 80 for significant, 50 for worth watching). However, `attentionRankingEngine.js` hardcodes `DEFAULT_THRESHOLDS` (60 for significant, 25 for worth watching) and does not read threshold overrides from the database.

---

## E. DATA FLOW DIAGRAM

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                   USER ACTION                                    │
│       (User opens app, adds stock, changes timeframe, or views dashboard)         │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                FRONTEND (React SPA)                              │
│  - App.tsx / AuthContext.tsx verifies Bearer token in localStorage              │
│  - useWatchlist.ts calls GET /api/watchlist                                      │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ HTTP Request (Bearer Token)
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            BACKEND (Express / Node.js)                           │
│  - requireAuth middleware verifies token hash in auth_sessions table             │
│  - watchlistService.getWatchlistView(userId) invoked                             │
└───────────────────┬──────────────────────────────────────────┬───────────────────┘
                    │                                          │
                    │ 1. Read Symbols & Last Snapshot          │ 2. Fetch Market Quotes
                    ▼                                          ▼
┌───────────────────────────────────────┐  ┌───────────────────────────────────────┐
│          POSTGRESQL DATABASE          │  │     EXTERNAL MARKET DATA PROVIDER     │
│  - Query watchlists & watchlist_stocks│  │  - marketDataService.getQuote()       │
│  - Query latest market_snapshots for  │  │  - Fetch Yahoo Finance Chart API      │
│    user's last acknowledged view      │  │    (query1.finance.yahoo.com)          │
└───────────────────┬───────────────────┘  └───────────────────┬───────────────────┘
                    │                                          │
                    └───────────────────┬──────────────────────┘
                                        │ (Previous Snapshot + Current Market Quote)
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            PROCESSING & ENGINES                                  │
│  1. changeDetectionEngine.computeSignals():                                      │
│     - Compute Price Signal (% change relative to 5% baseline)                    │
│     - Compute Volume Signal (% change relative to 200% baseline)                 │
│     - Compute Volatility Signal (Intraday range relative to 6% baseline)         │
│  2. attentionRankingEngine.rankAttention():                                      │
│     - Calculate Score = (Price*0.5 + Volume*0.3 + Volatility*0.2)               │
│     - Categorize Tier: Significant (>=60), Worth Watching (>=25), Normal (<25)   │
│  3. explanationService.buildExplanation():                                      │
│     - Generate non-financial observations & disclaimers                          │
│  4. reliabilityService.classifyFreshness():                                      │
│     - Assign freshness status (live, recent, delayed, stale, unavailable)        │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ JSON Response Payload
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              UI OUTPUT & AUTO-SAVE                               │
│  1. Dashboard renders summary counts & TierSections (Significant/Watching/Normal)│
│  2. Dashboard triggers acknowledgeView() -> POST /api/watchlist/view             │
│  3. Backend inserts current market quotes into market_snapshots table for NEXT   │
│     visit baseline comparison.                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## F. WATCHLIST LOGIC

### Adding & Removing Stocks
* **Adding a Stock**:
  - User searches for a company in `AddStockModal.tsx`.
  - Frontend queries `GET /api/instruments/search?q=...`, which searches the in-memory array parsed from Upstox's `complete.json.gz`.
  - User selects a stock and clicks "+ Add". Frontend calls `POST /api/watchlist/stocks` with payload `{ symbol, name, exchange, currency }`.
  - Backend upserts stock metadata into `stock_metadata` table, looks up the user's 'My Watchlist' ID in `watchlists`, and inserts a record into `watchlist_stocks`.
* **Removing a Stock**:
  - User clicks "Remove" on a stock card or row. `ConfirmationModal.tsx` prompts for confirmation.
  - User confirms. Frontend calls `DELETE /api/watchlist/stocks/:symbol`.
  - Backend deletes the row from `watchlist_stocks` for that `watchlist_id` and `symbol`.

### Displayed Fields
Each stock in the watchlist view contains:
* `symbol` (e.g., `TCS`, `INFY`)
* `name` (e.g., `Tata Consultancy Services`)
* `price` (current price in INR)
* `prevClose` (previous trading session close)
* `priceChangeSinceLastView` (% change relative to user's last acknowledged view)
* `volumeChangeSinceLastView` (% change in volume relative to user's last acknowledged view)
* `lastViewedAt` (ISO timestamp of user's last acknowledged view)
* `direction` (`up` | `down`)
* `volume` (latest trading volume)
* `status` (`ok` | `timeout` | `error` | `market_closed` | `unavailable`)
* `freshness` (`live` | `recent` | `delayed` | `stale` | `unavailable`)
* `attentionScore` (integer between 0 and 100)
* `tier` (`significant` | `worth_watching` | `normal`)
* `signals` (`priceSignal`, `volumeSignal`, `volatilitySignal`)
* `reasons` (array of plain-language strings)
* `explanation` (summary sentence)
* `explanationDisclaimer` (responsible use statement)

### Refresh & Data Sources
* **Data Sources**: Primary data source is **Yahoo Finance Chart API** (`query1.finance.yahoo.com/v8/finance/chart`), mapped automatically (e.g., `RELIANCE` -> `RELIANCE.NS`, `ZOMATO` -> `ETERNAL.NS`). If `config.marketDataProvider === 'demo'`, simulated replay data from `demoMarketDataService.js` is returned.
* **Data Nature**: Data is **delayed/historical market quotes** fetched over HTTPS (not real-time WebSocket tick streams). Freshness is dynamically evaluated on every request.

---

## G. EXISTING ANOMALY DETECTION

MarketPulse implements a **deterministic, rule-based signal & attention scoring model** (not machine learning or z-scores).

### 1. Signal Formulas (`changeDetectionEngine.js`)

#### A. Price Signal
Measures percentage price movement since the user's previous acknowledged snapshot:
$$\text{pctChange} = \left| \frac{\text{current.price} - \text{previous.price}}{\text{previous.price}} \right| \times 100$$
$$\text{priceSignal} = \text{clamp}\left( \frac{\text{pctChange}}{5} \times 100, \, 0, \, 100 \right)$$
*Explanation*: 0% price change yields a signal of 0; a 5% or greater price change yields a max signal of 100.

#### B. Volume Signal
Measures percentage change in trading volume since the user's previous acknowledged snapshot:
$$\text{volumeChange} = \frac{\left| \text{current.volume} - \text{previous.volume} \right|}{\text{previous.volume}}$$
$$\text{volumeSignal} = \text{clamp}\left( \frac{\text{volumeChange}}{2} \times 100, \, 0, \, 100 \right)$$
*Explanation*: 0% volume change yields 0; 100% volume change yields 50; 200% or greater volume change yields a max signal of 100.

#### C. Volatility Signal
Measures current intraday price range relative to previous close:
$$\text{rangePct} = \frac{\text{dayHigh} - \text{dayLow}}{\text{prevClose}} \times 100$$
$$\text{volatilitySignal} = \text{clamp}\left( \frac{\text{rangePct}}{6} \times 100, \, 0, \, 100 \right)$$
*Explanation*: 0% range yields 0; a 6% or wider intraday range yields a max signal of 100.

### 2. Attention Score Formula (`attentionRankingEngine.js`)
$$\text{attentionScore} = \text{clamp}\left( \text{round}\left( \text{priceSignal} \times 0.5 + \text{volumeSignal} \times 0.3 + \text{volatilitySignal} \times 0.2 \right), \, 0, \, 100 \right)$$

### 3. Product Tiers & Thresholds
* **Significant (Red Tier)**: `attentionScore >= 60`
* **Worth Watching (Yellow Tier)**: `25 <= attentionScore < 60`
* **Normal (Neutral Tier)**: `attentionScore < 25`

### 4. Alert Display
Anomalies are displayed in `Dashboard.tsx` under tier sections (`TierSection.tsx`), with color-coded accent indicators, attention score progress bars (`StockCard.tsx`), and expandable "Why did it change?" explanation drawers (`StockRow.tsx`).

---

## H. CODE QUALITY AND GAPS

1. **Threshold & Weight Discrepancies Across Files**:
   - `README.md` documents default weighting as Price 50%, Volume 30%, Volatility 20%.
   - `001_init.sql` sets `attention_thresholds` defaults to `significant_min = 80`, `worth_watching_min = 50`.
   - `attentionRankingEngine.js` hardcodes `significantMin = 60`, `worthWatchingMin = 25`.
2. **Unused / Duplicate Database Files**:
   - `src/db/database.js` in root and `backend/src/db/migrations/database.js` duplicate `backend/src/db/database.js`. They create redundant connection pools.
3. **Hardcoded Stock Symbol Mappings**:
   - `marketDataService.js` hardcodes ticker renames in `YAHOO_SYMBOL_MAP` (`ZOMATO: 'ETERNAL.NS'`, `TATAMOTORS: 'TMCV.NS'`). If other Indian stocks undergo ticker changes, market data requests for them will fail unless manually added to this object.
4. **Hardcoded Market Provider Check**:
   - `watchlistService.js` (lines 95 & 367) contains `if (config.marketDataProvider !== 'yahoo') throw new Error(...)`, preventing switching to Upstox or other providers even if configured in `.env`.
5. **Unused Database Tables**:
   - `change_signals` and `user_preferences` tables created in `001_init.sql` are never populated or queried by backend routes.
6. **Lack of Test Automation**:
   - The repository contains no unit, integration, or end-to-end test framework (e.g., Jest, Vitest, Playwright).
7. **Hardcoded Local API URLs**:
   - `AuthContext.tsx`, `useWatchlist.ts`, `useRecommendations.ts`, `AddStockModal.tsx`, `Dashboard.tsx`, and `StockDetail.tsx` fallback to `http://localhost:4000` if `VITE_API_BASE_URL` is unset.
8. **Missing Indexing on Auth Token Lookups**:
   - `authService.getUserFromToken` performs a SHA-256 hash lookup on `auth_sessions.token_hash`. While `002_auth.sql` defines `idx_auth_sessions_token`, expired session cleanup is not scheduled.

---

## I. HOW TO RUN THE PROJECT

### 1. Prerequisites
- Node.js (v18+ or v20+)
- PostgreSQL database (Local instance or Supabase URL)

### 2. Environment Setup
Create a `.env` file inside `backend/`:
```env
PORT=4000
NODE_ENV=development
DATABASE_URL=postgres://postgres:postgres@localhost:5432/marketpulse
MARKET_DATA_PROVIDER=yahoo
```

### 3. Database Migration & Seeding
Execute the SQL migration files against your PostgreSQL database in order:
1. `backend/src/db/migrations/001_init.sql`
2. `backend/src/db/migrations/002_auth.sql`
3. `backend/src/db/migrations/003_recommendations.sql`

Seed initial stocks and demo user (optional):
```bash
cd backend
node src/db/seedDemo.js
node src/db/seedStocks.js
node src/db/seedWatchlist.js
```

### 4. Running the Backend
```bash
cd backend
npm install
npm run dev
```
*Expected Output*:
`MarketPulse backend listening on http://localhost:4000`

### 5. Running the Frontend
```bash
cd frontend
npm install
npm run dev
```
*Expected Output*:
Vite dev server running on `http://localhost:5173`

---

## J. CONTINUATION PLAN (NEXT 10 DEVELOPMENT TASKS)

Below are 10 prioritized development tasks for the next phase, strictly aligned with fixing existing architectural gaps and expanding product capabilities:

1. **Reconcile Thresholds & Connect `attention_thresholds` DB Table**:
   - Update `attentionRankingEngine.js` to dynamically fetch thresholds from the `attention_thresholds` database table instead of using hardcoded constants.
2. **Clean Up Duplicate Database Connector Files**:
   - Remove redundant files `src/db/database.js` and `backend/src/db/migrations/database.js`, ensuring all database imports reference `backend/src/db/database.js`.
3. **Persist Calculated Signals to `change_signals` Table**:
   - Modify `saveCurrentWatchlistView` in `watchlistService.js` to insert computed signals, attention scores, tiers, and reason JSON into `change_signals` upon view acknowledgement.
4. **Implement User Preference Endpoints (`user_preferences`)**:
   - Build REST endpoints (`GET /api/user/preferences`, `PUT /api/user/preferences`) to persist user theme choices and attention sensitivity multipliers to PostgreSQL.
5. **Dynamic Yahoo Symbol Resolution & Fallback Engine**:
   - Replace hardcoded `YAHOO_SYMBOL_MAP` with dynamic exchange ticker resolution and fallback to BSE (`.BO`) if NSE (`.NS`) query returns unavailable.
6. **Implement Test Suite (Vitest & Supertest)**:
   - Add Vitest test runner to backend and frontend. Write unit tests for `changeDetectionEngine`, `attentionRankingEngine`, `explanationService`, and integration tests for auth routes.
7. **Scheduled Background Session & Snapshot Cleanup**:
   - Implement a cron job or scheduled worker service to purge expired session rows from `auth_sessions` and prune old market snapshot rows from `market_snapshots`.
8. **Upstox Provider Implementation**:
   - Implement an Upstox live market data provider service in `backend/src/services/upstoxMarketDataService.js` and remove the hardcoded provider restriction in `watchlistService.js`.
9. **Centralize Frontend API Base URL Configuration**:
   - Extract API URL construction into a single centralized client configuration module in frontend (`frontend/src/config/api.ts`) to avoid repetitive `import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'` calls across components.
10. **Add Stock Search Debounce & Caching Optimizations**:
    - Enhance `instrumentSearchService.js` to store the unzipped Upstox instrument index in a local file cache or Redis instance, reducing startup memory consumption.
