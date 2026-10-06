# MarketPulse: Implementation Plan for Anomaly Detection & Movement Attribution

> **Target Goal**: Upgrade MarketPulse to an *Intelligent Watchlist with Explainable Movement Attribution and Anomaly Detection* using statistical rolling Z-scores, NIFTY 50 benchmark beta calculation, CAPM movement attribution, and Silent Signal detection.
> **Branch**: `anomaly-detection`
> **Architecture Constraint**: Maintain current React 19 + TypeScript frontend, Node.js Express backend, and Yahoo Finance integration. Do NOT switch branches or create a separate Python/Streamlit app.

---

## Architecture & Data Flow Overview

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            1. DATA EXTENSION (Backend)                           │
│  - marketDataService.js fetches daily OHLCV series (>= 90 trading days)          │
│  - Fetches NIFTY 50 benchmark (^NSEI) daily series                              │
│  - Implements in-memory TTL caching (15m) for daily series                        │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ Daily OHLCV Data Arrays
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         2. STATISTICAL ANALYSIS ENGINE                           │
│  - statisticalAnalysisService.js computes:                                       │
│    * Daily returns: R_t = (P_t - P_{t-1}) / P_{t-1}                             │
│    * 20-day rolling mean & std for returns and volume (μ_R, σ_R, μ_V, σ_V)       │
│    * Volume Ratio = V_t / μ_V                                                    │
│    * Return Z-Score = (R_t - μ_R) / σ_R                                          │
│    * Volume Z-Score = (V_t - μ_V) / σ_V                                          │
│    * 20-day rolling volatility σ_20 and Volatility Z-Score                       │
│    * 60-day rolling Beta: β_60 = Cov(R_stock, R_NIFTY50) / Var(R_NIFTY50)        │
│    * CAPM Attribution: R_market_driven = β_60 * R_NIFTY50                        │
│                         R_stock_specific = R_stock - R_market_driven             │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ Calculated Statistical Indicators
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           3. ANOMALY DETECTION ENGINE                            │
│  - anomalyDetectionEngine.js evaluates statistical rules:                        │
│    * Unusual Price: abs(returnZScore) >= 2.5                                     │
│    * Unusual Volume: volumeZScore >= 3.0                                         │
│    * Volume Spike: volumeRatio >= 2.0                                            │
│    * Unusual Volatility: volatilityZScore >= 2.5                                 │
│    * Silent Signal: volumeRatio >= 2.0 AND abs(dailyReturnPercent) < 0.5         │
│    * Composite Anomaly Score (0–100) & Anomaly Status                            │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ Anomaly Metrics & Badges
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         4. EXPLANATION & RANKING ENGINE                          │
│  - explanationService.js generates professional non-financial summaries          │
│  - Uses terms: "statistically unusual activity", "requires investigation"         │
│  - Prohibits terms: "fake volume", "fraud", "manipulation"                       │
│  - attentionRankingEngine.js ranks watchlist items by Anomaly Score (0-100)      │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ WatchlistView JSON Response
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            5. DASHBOARD UI INTEGRATION                           │
│  - watchlist.ts types updated with statistical & attribution properties          │
│  - StockCard.tsx renders Anomaly Score, Volume Ratio, Z-Score, Silent Badge      │
│  - StockRow.tsx expandable drawer renders Anomaly Status & Movement Attribution  │
│  - StockDetail.tsx renders Z-Score metrics grid & Market vs Stock % split        │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Milestone Details

### Milestone 1: Extend Historical Data Fetching

#### Goal
Extend backend market data fetcher to reliably return at least 90 daily trading candles for each selected NSE stock, add support for the NIFTY 50 benchmark ticker (`^NSEI`), and implement caching with graceful fallback handling.

#### Exact Files to Modify / Create
* **Modify**: `backend/src/services/marketDataService.js`
* **Modify**: `backend/src/routes/market.js`

#### Functions to Create / Update
1. **`getHistoricalPrices(symbol, range = '1d', interval = null)`** in `marketDataService.js`:
   - Update parameter mapping to allow `range = '3mo'` or `range = '6mo'` with `interval = '1d'`.
   - Ensure the function returns at least 90 valid, sorted daily OHLCV candles (`{ timestamp, open, high, low, price, volume }`).
2. **`getBenchmarkHistory(range = '3mo')`** (NEW FUNCTION) in `marketDataService.js`:
   - Fetches historical daily candles for NIFTY 50 benchmark ticker `^NSEI` (or `^NSEBANK` fallback) via Yahoo Finance Chart API.
3. **In-Memory Cache Mechanism**:
   - Add simple TTL cache map `historyCache = new Map()` in `marketDataService.js` storing responses for 15 minutes (`15 * 60 * 1000 ms`) to prevent redundant external API requests.

#### Input and Output Data Shapes
* **Input**: `symbol: string` (e.g. `'TCS'`, `'^NSEI'`), `range: '3mo'`
* **Output**:
```ts
interface HistoricalPricesResponse {
  symbol: string;
  name: string;
  status: 'ok' | 'unavailable' | 'error';
  source: 'yahoo-finance';
  retrievedAt: string;
  marketTimestamp: string | null;
  yahooSymbol: string;
  range: string;
  interval: string;
  points: Array<{
    timestamp: string; // ISO date string
    price: number;     // Closing price
    open: number | null;
    high: number | null;
    low: number | null;
    volume: number | null;
  }>;
}
```

#### Acceptance Criteria
- Executing `getHistoricalPrices('TCS', '3mo')` returns $\ge 60$ (target $\ge 90$) daily OHLCV candles sorted chronologically.
- Executing `getBenchmarkHistory('3mo')` returns $\ge 90$ daily OHLCV candles for `^NSEI`.
- Repeated requests for the same symbol within 15 minutes serve from cache.
- Yahoo API timeouts or 404s degrade gracefully by returning `{ status: 'unavailable', points: [] }` without crashing the process.

#### Risks and Validation Checks
- **Risk**: Yahoo Finance rate-limiting or returning `null` volume arrays for certain days.
- **Validation**: Filter out candle points where `price <= 0` or `timestamp` is invalid. Log warnings on cache misses.

---

### Milestone 2: Build Statistical Calculations Engine

#### Goal
Build a dedicated statistical engine module (`statisticalAnalysisService.js`) to compute daily returns, 20-day rolling mean/std for returns and volume, volume ratio, return Z-score, volume Z-score, 20-day rolling volatility Z-score, and 60-day rolling beta.

#### Exact Files to Modify / Create
* **Create**: `backend/src/services/statisticalAnalysisService.js`

#### Functions to Create
1. **`calculateDailyReturns(points)`**:
   - Computes daily return series: $R_t = \frac{P_t - P_{t-1}}{P_{t-1}}$.
2. **`calculateRollingStats(values, windowSize = 20)`**:
   - Calculates rolling mean $\mu$ and sample standard deviation $\sigma = \sqrt{\frac{\sum (x_i - \mu)^2}{N-1}}$.
3. **`calculateZScore(currentValue, mean, stdDev)`**:
   - Returns $(currentValue - mean) / stdDev$. Returns `0` if $stdDev == 0$ or invalid.
4. **`calculate20DayVolatility(dailyReturns)`**:
   - Calculates 20-day annualized or standard rolling volatility of returns.
5. **`calculateRollingBeta(stockReturns, benchmarkReturns, windowSize = 60)`**:
   - Aligns stock and benchmark return timestamps.
   - Calculates covariance $\text{Cov}(R_S, R_B)$ and benchmark variance $\text{Var}(R_B)$ over 60 trading days:
     $$\beta_{60} = \frac{\sum_{k=0}^{59} (R_{S, k} - \bar{R}_S)(R_{B, k} - \bar{R}_B)}{\sum_{k=0}^{59} (R_{B, k} - \bar{R}_B)^2}$$
6. **`computeStockStatistics(stockPoints, benchmarkPoints)`** (MAIN ENTRYPOINT):
   - Computes all statistical indicators for a given stock series against benchmark series.

#### Input and Output Data Shapes
* **Input**: `stockPoints: Array<Point>`, `benchmarkPoints: Array<Point>`
* **Output**:
```ts
interface StockStatisticalMetrics {
  currentPrice: number;
  currentVolume: number;
  latestReturn: number;              // Daily return (e.g. 0.015 for +1.5%)
  returnMean20: number;
  returnStd20: number;
  returnZScore: number;
  volumeMean20: number;
  volumeStd20: number;
  volumeRatio: number;               // Current Volume / 20d Volume Mean
  volumeZScore: number;
  volatility20: number;
  volatilityZScore: number;
  beta60: number | null;             // 60-day rolling beta (null if N < 60)
  benchmarkReturn: number | null;    // NIFTY 50 return on latest day
  sampleSize: number;
  hasSufficientHistory20: boolean;  // points >= 20
  hasSufficientHistory60: boolean;  // points >= 60
}
```

#### Acceptance Criteria
- Handles sample size edge cases ($N < 20$ returns `hasSufficientHistory20 = false`, $N < 60$ returns `beta60 = null`).
- Safe division: Returns Z-score of 0 when $\sigma = 0$ or volume mean is 0.
- Skips non-trading holidays gracefully by pairing stock and benchmark timestamps.

#### Risks and Validation Checks
- **Risk**: Missing dates in benchmark vs stock (e.g. stock suspended or holiday mismatch).
- **Validation**: Match timestamps via an explicit Map lookup on `YYYY-MM-DD` string keys before computing covariance.

---

### Milestone 3: Build Anomaly Rules and Score Engine

#### Goal
Build a deterministic anomaly engine (`anomalyDetectionEngine.js`) that evaluates statistical thresholds, detects Silent Signals (high volume + minimal price movement), calculates a composite 0–100 Anomaly Score, and outputs approved professional explanations.

#### Exact Files to Modify / Create
* **Create**: `backend/src/services/anomalyDetectionEngine.js`

#### Rules & Threshold Definitions
1. **Unusual Price Movement**: `Math.abs(returnZScore) >= 2.5`
2. **Unusual Volume**: `volumeZScore >= 3.0`
3. **Volume Spike**: `volumeRatio >= 2.0`
4. **Unusual Volatility**: `volatilityZScore >= 2.5`
5. **Silent Signal**: `volumeRatio >= 2.0 && Math.abs(latestReturnPercent) < 0.5` (Volume $\ge 2\times$ average, while price moves $< 0.5\%$).

#### Anomaly Score Formula (0 to 100)
$$\text{BaseScore} = \text{clamp}\left( |Z_{\text{return}}| \times 18 + Z_{\text{volume}} \times 12 + Z_{\text{volatility}} \times 10, \, 0, \, 80 \right)$$
$$\text{SilentBonus} = \text{isSilentSignal} \, ? \, 20 : 0$$
$$\text{AnomalyScore} = \text{clamp}\left( \text{round}(\text{BaseScore} + \text{SilentBonus}), \, 0, \, 100 \right)$$

#### Anomaly Status Classification
* **Critical Anomaly**: `AnomalyScore >= 75` OR (`isUnusualPrice` AND `isUnusualVolume`)
* **Elevated Activity**: `50 <= AnomalyScore < 75` OR `isSilentSignal`
* **Normal Activity**: `AnomalyScore < 50`

#### Language Restrictions (STRICT)
* **PROHIBITED WORDS**: `"fake volume"`, `"fraud"`, `"manipulation"`, `"insider"`, `"pump"`, `"dump"`.
* **REQUIRED APPROVED PHRASES**: `"statistically unusual activity"`, `"requires investigation"`, `"unusual volume ratio"`, `"price-volume divergence"`, `"observation of market activity"`.

#### Input and Output Data Shapes
* **Input**: `metrics: StockStatisticalMetrics`
* **Output**:
```ts
interface AnomalyDetectionResult {
  anomalyScore: number;             // Clamped 0-100
  anomalyStatus: 'Critical Anomaly' | 'Elevated Activity' | 'Normal Activity';
  isUnusualPrice: boolean;
  isUnusualVolume: boolean;
  isVolumeSpike: boolean;
  isUnusualVolatility: boolean;
  isSilentSignal: boolean;
  flags: string[];                  // e.g. ["Unusual Price Movement", "Silent Signal"]
  summaryText: string;              // Approved explanation string
}
```

#### Acceptance Criteria
- Anomaly score is strictly bounded between 0 and 100.
- Silent Signal correctly triggers when `volumeRatio >= 2.0` and `Math.abs(dailyReturn) < 0.5%`.
- Generated explanations contain zero prohibited words.

#### Risks and Validation Checks
- **Validation**: Unit test regex scan over all generated text to verify no prohibited words appear.

---

### Milestone 4: Integrate Results into Attention Ranking Engine

#### Goal
Integrate the new statistical anomaly score and Z-score flags into `attentionRankingEngine.js` and `watchlistService.js`.

#### Exact Files to Modify
* **Modify**: `backend/src/services/attentionRankingEngine.js`
* **Modify**: `backend/src/services/explanationService.js`
* **Modify**: `backend/src/services/watchlistService.js`

#### Implementation Steps
1. **Update `rankAttention()`** in `attentionRankingEngine.js`:
   - Accept statistical anomaly score `anomalyResult.anomalyScore` as the primary driver for `attentionScore`.
   - Maintain tier mapping: `significant` (`anomalyScore >= 60`), `worth_watching` (`anomalyScore >= 25`), `normal` (`anomalyScore < 25`).
2. **Update `explanationService.js`**:
   - Include specific statistical reason strings:
     - `"Trading volume is 2.4x its 20-day average baseline (statistically unusual activity)."`
     - `"Silent Signal detected: High volume activity accompanied by minimal price movement (<0.5%), requiring investigation."`
     - `"Price moved 3.1 standard deviations beyond its 20-day mean return."`
3. **Update `getWatchlistView()`** in `watchlistService.js`:
   - Fetch benchmark daily history `getBenchmarkHistory('3mo')`.
   - For each watchlist stock, fetch daily history, compute `StockStatisticalMetrics` via `statisticalAnalysisService`, compute `AnomalyDetectionResult` via `anomalyDetectionEngine`, and include outputs in the returned `WatchlistItem` object.

#### Acceptance Criteria
- Dashboard API response (`GET /api/watchlist`) includes full statistical metrics and anomaly scores for each watchlist stock.
- Tier grouping correctly sorts stocks with high anomaly scores into `Significant` and `Worth Watching` sections.

---

### Milestone 5: Display Anomaly Information in Existing Dashboard UI

#### Goal
Extend existing React UI components (`Dashboard.tsx`, `StockCard.tsx`, `StockRow.tsx`, `StockDetail.tsx`) to display anomaly score, anomaly status, volume ratio, return Z-score, Silent Signal badge, and explanation cards.

#### Exact Files to Modify
* **Modify**: `frontend/src/types/watchlist.ts`
* **Modify**: `frontend/src/components/StockCard.tsx`
* **Modify**: `frontend/src/components/StockRow.tsx`
* **Modify**: `frontend/src/components/StockDetail.tsx`
* **Modify**: `frontend/src/components/Dashboard.tsx`

#### UI Components & Elements to Add
1. **`watchlist.ts` Interface Extension**:
   - Add fields to `WatchlistItem`:
     ```ts
     anomalyScore: number;
     anomalyStatus: string;
     volumeRatio: number | null;
     returnZScore: number | null;
     volumeZScore: number | null;
     volatilityZScore: number | null;
     isSilentSignal: boolean;
     ```
2. **Silent Signal Badge Component** (in `StockCard.tsx` and `StockRow.tsx`):
   - Render a prominent badge: `🤫 Silent Signal` (amber/purple soft background) when `isSilentSignal === true`.
3. **Metrics Grid on Stock Card** (`StockCard.tsx`):
   - Display `Volume Ratio` (e.g. `2.4x avg`) and `Return Z-Score` (e.g. `+2.8σ`).
4. **Expandable Explanation Drawer** (`StockRow.tsx`):
   - Render `anomalyStatus` badge and statistical explanation text.
5. **Statistical Dashboard Section** (`StockDetail.tsx`):
   - Render 4 metric cards:
     - Return Z-Score ($Z_R$)
     - Volume Z-Score ($Z_V$)
     - Volume Ratio ($V / \bar{V}_{20}$)
     - Volatility Z-Score ($Z_{\sigma}$)
   - Display Silent Signal Card with explanation of accumulation/distribution observation.

#### Acceptance Criteria
- Stocks with Silent Signal display the `Silent Signal` badge across cards, table rows, and detail view.
- Return Z-Score and Volume Ratio values render formatted to 2 decimal places.
- Design tokens (`var(--attention-soft)`, `var(--brand)`, etc.) are strictly maintained across both light and dark themes.

---

### Milestone 6: Add CAPM Movement Attribution

#### Goal
Implement 60-day rolling beta computation against the NIFTY 50 index (`^NSEI`) and attribute today's stock movement into **Market-Driven** and **Stock-Specific (Idiosyncratic)** components.

#### Exact Files to Modify / Create
* **Modify**: `backend/src/services/statisticalAnalysisService.js`
* **Modify**: `backend/src/services/explanationService.js`
* **Modify**: `backend/src/services/watchlistService.js`
* **Modify**: `frontend/src/types/watchlist.ts`
* **Modify**: `frontend/src/components/StockDetail.tsx`
* **Modify**: `frontend/src/components/StockCard.tsx`

#### CAPM Movement Attribution Formulas
1. **NIFTY 50 Daily Return**: $R_{\text{NIFTY50}} = \frac{P_{\text{NIFTY}, t} - P_{\text{NIFTY}, t-1}}{P_{\text{NIFTY}, t-1}}$
2. **60-Day Beta**: $\beta_{60} = \frac{\text{Cov}(R_{\text{stock}}, R_{\text{NIFTY50}})}{\text{Var}(R_{\text{NIFTY50}})}$
3. **Market-Driven Component**: $R_{\text{market\_driven}} = \beta_{60} \times R_{\text{NIFTY50}}$
4. **Stock-Specific Component**: $R_{\text{stock\_specific}} = R_{\text{stock}} - R_{\text{market\_driven}}$
5. **Attribution Ratio**:
   $$\text{Market Share \%} = \frac{|R_{\text{market\_driven}}|}{|R_{\text{market\_driven}}| + |R_{\text{stock\_specific}}|} \times 100$$
   $$\text{Stock Share \%} = \frac{|R_{\text{stock\_specific}}|}{|R_{\text{market\_driven}}| + |R_{\text{stock\_specific}}|} \times 100$$

#### Insufficient History Classification
- If fewer than 60 paired trading days are available, return:
  `attributionStatus: 'insufficient_data'`, `attributionText: 'Not enough data (requires 60 trading days)'`.

#### Data Shape Extensions
```ts
interface MovementAttribution {
  beta60: number | null;
  marketReturn: number | null;
  stockReturn: number;
  marketDrivenReturn: number | null;
  stockSpecificReturn: number | null;
  marketSharePct: number | null;
  stockSharePct: number | null;
  attributionStatus: 'ok' | 'insufficient_data';
  attributionText: string; // e.g. "65% Market-Driven (NIFTY 50), 35% Stock-Specific"
}
```

#### Acceptance Criteria
- If history $\ge 60$ days, calculates $\beta_{60}$ and returns percentage attribution split.
- Stock detail view (`StockDetail.tsx`) renders a Movement Attribution Card with a progress bar showing Market vs Stock-Specific breakdown.
- Handles $N < 60$ gracefully by displaying "Not enough data".

---

### Milestone 7: Add Unit Tests for Calculations and Rules

#### Goal
Add automated backend unit tests using Node.js native test runner (`node:test`) and assertion module (`node:assert`) to verify all statistical calculations, Z-scores, beta calculations, anomaly rules, score clamping, edge cases, and language policy enforcement.

#### Exact Files to Create
* **Create**: `backend/tests/statisticalAnalysisService.test.js`
* **Create**: `backend/tests/anomalyDetectionEngine.test.js`

#### Test Coverage Requirements
1. **`statisticalAnalysisService.test.js`**:
   - Test daily returns calculation on known price series.
   - Test 20-day rolling mean & standard deviation calculation.
   - Test zero standard deviation case (returns Z-score = 0, no division by zero).
   - Test 60-day rolling beta calculation against mock benchmark series.
   - Test insufficient history handling ($N < 20$, $N < 60$).
   - Test date alignment when stock or benchmark has missing dates.
2. **`anomalyDetectionEngine.test.js`**:
   - Test Unusual Price rule (`returnZScore >= 2.5`).
   - Test Unusual Volume rule (`volumeZScore >= 3.0`).
   - Test Volume Spike rule (`volumeRatio >= 2.0`).
   - Test Unusual Volatility rule (`volatilityZScore >= 2.5`).
   - Test Silent Signal rule (`volumeRatio >= 2.0 && abs(return) < 0.5`).
   - Test Anomaly Score bounds ($0 \le \text{Score} \le 100$).
   - Test Prohibited Language Scanner: Scan all generated text outputs to ensure words like `"fake volume"`, `"fraud"`, `"manipulation"` never appear.

#### NPM Test Script Update
Add test script to `backend/package.json`:
```json
"scripts": {
  "dev": "node --watch src/server.js",
  "start": "node src/server.js",
  "test": "node --test tests/*.test.js"
}
```

#### Acceptance Criteria
- Running `npm test` inside `backend/` passes all test cases with 0 errors.

---

## Complete Summary of Files to Modify & Create

| Action | File Path | Milestone |
| :--- | :--- | :--- |
| **Modify** | `backend/package.json` | Milestone 7 (Add `"test"` script) |
| **Modify** | `backend/src/services/marketDataService.js` | Milestone 1 & 6 (90-day history, NIFTY 50 `^NSEI`, TTL caching) |
| **Modify** | `backend/src/routes/market.js` | Milestone 1 (Allow 90d / 3mo range queries) |
| **Create** | `backend/src/services/statisticalAnalysisService.js` | Milestone 2 & 6 (Returns, rolling mean/std, Z-scores, Beta, CAPM) |
| **Create** | `backend/src/services/anomalyDetectionEngine.js` | Milestone 3 (Z-score rules, Silent Signal, Anomaly Score 0-100) |
| **Modify** | `backend/src/services/attentionRankingEngine.js` | Milestone 4 (Integrate Anomaly Score into product tiers) |
| **Modify** | `backend/src/services/explanationService.js` | Milestone 4, 5, 6 (Stat explanations, prohibited word enforcement) |
| **Modify** | `backend/src/services/watchlistService.js` | Milestone 4 & 6 (Connect statistical and anomaly engines to watchlist API) |
| **Modify** | `frontend/src/types/watchlist.ts` | Milestone 5 & 6 (TypeScript interfaces for anomaly & attribution metrics) |
| **Modify** | `frontend/src/components/StockCard.tsx` | Milestone 5 & 6 (Render Anomaly Score, Silent Badge, Volume Ratio, Z-Score) |
| **Modify** | `frontend/src/components/StockRow.tsx` | Milestone 5 & 6 (Render Silent Badge, Anomaly Status, drawer attribution) |
| **Modify** | `frontend/src/components/StockDetail.tsx` | Milestone 5 & 6 (Render Z-score metric grid, Silent Card, CAPM Attribution card) |
| **Modify** | `frontend/src/components/Dashboard.tsx` | Milestone 5 (Pass anomaly state to child components) |
| **Create** | `backend/tests/statisticalAnalysisService.test.js` | Milestone 7 (Unit tests for statistics and beta) |
| **Create** | `backend/tests/anomalyDetectionEngine.test.js` | Milestone 7 (Unit tests for rules, score clamping, language check) |

---

## Validation & Execution Order

1. **Phase 1 (Data & Stats)**: Implement Milestones 1 & 2 -> Run `node --test tests/statisticalAnalysisService.test.js`.
2. **Phase 2 (Anomaly & Language)**: Implement Milestone 3 -> Run `node --test tests/anomalyDetectionEngine.test.js`.
3. **Phase 3 (Service Integration)**: Implement Milestones 4 & 6 in backend services.
4. **Phase 4 (Frontend UI)**: Implement Milestone 5 & 6 in React TypeScript components.
5. **Phase 5 (Full Verification)**: Run full test suite (`npm test`) and inspect dashboard UI runtime verification.
