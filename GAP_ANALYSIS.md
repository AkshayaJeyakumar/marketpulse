# MarketPulse: Gap Analysis for Anomaly Detection & Movement Attribution

> **Target Specification**: *Intelligent Watchlist with Explainable Movement Attribution and Anomaly Detection.*
> **Branch**: `anomaly-detection`
> **Base Reference**: [PROJECT_SPECIFICATION.md](file:///c:/projects/marketpulse/PROJECT_SPECIFICATION.md)

---

## Executive Summary

This gap analysis compares the existing **MarketPulse** codebase against the 10 target features required for the **Intelligent Watchlist with Explainable Movement Attribution and Anomaly Detection**. 

Currently, MarketPulse possesses a solid full-stack foundation (React 19 SPA + Node.js Express REST API + PostgreSQL) with snapshot diffing, rule-based signal scaling, attention ranking, and plain-language explanations. However, the existing anomaly detection relies on single-view linear ratio scaling rather than statistical rolling Z-scores, and lacks NIFTY 50 market benchmark index correlation, rolling 60-day beta computation, CAPM movement attribution, and Silent Signal detection.

---

## Feature-by-Feature Gap Analysis

### 1. Fetch daily OHLCV data for selected NIFTY 50 stocks using yfinance
* **Status**: **Partially Implemented**
* **What Exists**:
  - Backend service fetches daily and intraday OHLCV market chart data directly from Yahoo Finance API (`query1.finance.yahoo.com/v8/finance/chart`).
  - PostgreSQL schema seeds core NIFTY 50 equities (`TCS`, `INFY`, `RELIANCE`, `TATAMOTORS`, `HDFCBANK`, `ITC`, `ADANIENT`) into `stock_metadata`.
  - Endpoint `GET /api/market/history/:symbol?range=1d|1w|1m` serves historical candle data points.
* **Which File / Function Contains It**:
  - `backend/src/services/marketDataService.js`: `getQuote()`, `getHistoricalPrices()`
  - `backend/src/routes/market.js`: `GET /history/:symbol`
  - `backend/src/db/seedStocks.js`: NIFTY 50 symbol seeding
* **What Must Be Added or Changed**:
  - The current JS implementation fetches 1D, 1W, and 1M candles via Yahoo Finance REST HTTP endpoints. For 20-day rolling statistics and 60-day rolling beta, historical daily OHLCV series must be expanded to at least 60–90 trading days.
  - If integrating Python `yfinance` or a Python microservice, a script/module using `yfinance.download()` for the NIFTY 50 universe (`.NS` tickers) can be added or bridged to the Node.js API.
* **Whether It Can Be Reused Safely**:
  - **Yes**, the Yahoo Finance ticker normalization logic (`.NS` suffixing, `ZOMATO` -> `ETERNAL.NS`) and fetch wrapper (`withReliability`) in `marketDataService.js` can be safely reused and expanded for multi-day daily OHLCV series.

---

### 2. Fetch NIFTY 50 index data
* **Status**: **Not Implemented**
* **What Exists**:
  - Instrument search and metadata storage only handle individual equity symbols (`NSE_EQ`, `BSE_EQ`).
* **Which File / Function Contains It**:
  - N/A
* **What Must Be Added or Changed**:
  - Add data retrieval logic for the NIFTY 50 benchmark index (Yahoo Finance ticker `^NSEI` or `NIFTY 50.NS`).
  - Store/cache daily index OHLCV values over a 60+ trading day window to allow daily index return calculation ($R_{\text{NIFTY50}}$).
* **Whether It Can Be Reused Safely**:
  - N/A (New feature requiring benchmark index fetching capability).

---

### 3. Calculate daily returns, 20-day rolling average volume, 20-day rolling volatility, and 60-day rolling beta
* **Status**: **Partially Implemented**
* **What Exists**:
  - `changeDetectionEngine.js` calculates single-point diffs: price percentage change between current view and last snapshot, volume percentage change between current view and last snapshot, and single-day intraday range ratio.
* **Which File / Function Contains It**:
  - `backend/src/services/changeDetectionEngine.js`: `computePriceSignal()`, `computeVolumeSignal()`, `computeVolatilitySignal()`
* **What Must Be Added or Changed**:
  - Upgrade math from single-snapshot diffing to true historical rolling window calculations:
    1. **Daily Returns**: $R_{i,t} = \frac{P_{i,t} - P_{i,t-1}}{P_{i,t-1}}$
    2. **20-Day Rolling Average Volume**: $\bar{V}_{20} = \frac{1}{20} \sum_{k=0}^{19} V_{t-k}$
    3. **20-Day Rolling Volatility**: $\sigma_{20} = \sqrt{\frac{1}{20} \sum_{k=0}^{19} (R_{t-k} - \bar{R}_{20})^2}$
    4. **60-Day Rolling Beta**: $\beta_{60} = \frac{\text{Cov}(R_{\text{stock}}, R_{\text{NIFTY50}})}{\text{Var}(R_{\text{NIFTY50}})}$ over a 60-trading-day window.
* **Whether It Can Be Reused Safely**:
  - **Yes**, the execution pipeline in `changeDetectionEngine.js` can be refactored to compute and accept statistical rolling metrics.

---

### 4. Detect unusual price movement using return z-score
* **Status**: **Not Implemented**
* **What Exists**:
  - Price movement signal (`computePriceSignal`) uses fixed linear ratio scaling: `clamp((pctChange / 5) * 100, 0, 100)` (0% -> 0, 5% -> 100).
* **Which File / Function Contains It**:
  - `backend/src/services/changeDetectionEngine.js`: `computePriceSignal()`
* **What Must Be Added or Changed**:
  - Replace/supplement linear 5% price scaling with Return Z-Score:
    $$Z_{\text{return}} = \frac{R_t - \mu_{R, 20}}{\sigma_{R, 20}}$$
    where $\mu_{R, 20}$ and $\sigma_{R, 20}$ are the 20-day rolling mean and standard deviation of daily returns.
* **Whether It Can Be Reused Safely**:
  - **Yes**, `computePriceSignal()` can be refactored to consume $Z_{\text{return}}$ as its underlying metric.

---

### 5. Detect unusual volume using volume z-score and volume ratio
* **Status**: **Partially Implemented**
* **What Exists**:
  - Volume change signal (`computeVolumeSignal`) calculates percentage change relative to previous snapshot volume: `clamp((volumeChange / 2) * 100, 0, 100)`.
* **Which File / Function Contains It**:
  - `backend/src/services/changeDetectionEngine.js`: `computeVolumeSignal()`
* **What Must Be Added or Changed**:
  - Add statistical volume anomaly metrics:
    1. **Volume Ratio**: $\text{VR}_t = \frac{V_t}{\bar{V}_{20}}$
    2. **Volume Z-Score**: $Z_{\text{volume}} = \frac{V_t - \mu_{V, 20}}{\sigma_{V, 20}}$ (or log-volume Z-score for skewed volume distributions).
* **Whether It Can Be Reused Safely**:
  - **Yes**, `computeVolumeSignal()` can be updated to combine Volume Ratio and Volume Z-Score into its signal score output.

---

### 6. Detect unusual volatility using volatility z-score
* **Status**: **Partially Implemented**
* **What Exists**:
  - Volatility signal (`computeVolatilitySignal`) evaluates single-day intraday range relative to previous close: `clamp((rangePct / 6) * 100, 0, 100)` where `rangePct = (dayHigh - dayLow) / prevClose * 100`.
* **Which File / Function Contains It**:
  - `backend/src/services/changeDetectionEngine.js`: `computeVolatilitySignal()`
* **What Must Be Added or Changed**:
  - Replace fixed 6% range threshold with Volatility Z-Score:
    $$Z_{\text{volatility}} = \frac{\sigma_{t, \text{current}} - \mu_{\sigma, 20}}{\sigma_{\sigma, 20}}$$
    evaluating current daily volatility against the stock's own 20-day historical baseline.
* **Whether It Can Be Reused Safely**:
  - **Yes**, `computeVolatilitySignal()` can be refactored to compute Volatility Z-Scores.

---

### 7. Detect Silent Signal: high volume but very small price movement
* **Status**: **Not Implemented**
* **What Exists**:
  - Current signal engines evaluate price, volume, and volatility independently without checking joint conditions.
* **Which File / Function Contains It**:
  - N/A
* **What Must Be Added or Changed**:
  - Add Silent Signal detection logic:
    - **Condition**: High volume ($\text{Volume Ratio} \ge 1.5$ or $Z_{\text{volume}} \ge 1.5$) AND minimal price movement ($|R_t| \le 0.3\%$).
    - **Significance**: Indicates potential institutional accumulation or distribution where heavy trading activity occurs without driving immediate price movement.
    - **Output**: Pass `isSilentSignal: boolean` flag to `attentionRankingEngine.js` and `explanationService.js`.
* **Whether It Can Be Reused Safely**:
  - N/A (New joint condition logic to be added to `changeDetectionEngine.js` and `explanationService.js`).

---

### 8. Calculate an anomaly score from 0 to 100
* **Status**: **Partially Implemented**
* **What Exists**:
  - `attentionRankingEngine.js` calculates an `attentionScore` (0–100) using:
    $$\text{attentionScore} = \text{clamp}\left(\text{round}(0.5 \times \text{priceSignal} + 0.3 \times \text{volumeSignal} + 0.2 \times \text{volatilitySignal}), 0, 100\right)$$
  - Maps score to tiers: `significant` (>= 60), `worth_watching` (>= 25), `normal` (< 25).
* **Which File / Function Contains It**:
  - `backend/src/services/attentionRankingEngine.js`: `rankAttention()`
* **What Must Be Added or Changed**:
  - Update scoring inputs from simple linear diff ratios to composite statistical Z-scores ($Z_{\text{return}}$, $Z_{\text{volume}}$, $Z_{\text{volatility}}$) and incorporate the Silent Signal bonus.
  - Standardize Z-score aggregation into a unified 0–100 Anomaly Score scale.
* **Whether It Can Be Reused Safely**:
  - **Yes**, `rankAttention()` structure, tier mapping (`significant`, `worth_watching`, `normal`), and score clamping can be fully reused.

---

### 9. Attribute stock movement into market-driven and stock-specific components using beta
* **Status**: **Not Implemented**
* **What Exists**:
  - No movement attribution or beta decomposition currently exists.
* **Which File / Function Contains It**:
  - N/A
* **What Must Be Added or Changed**:
  - Implement CAPM Return Movement Attribution logic:
    1. **Market-Driven Component**: $R_{\text{market\_driven}} = \beta_{60} \times R_{\text{NIFTY50}}$
    2. **Stock-Specific (Idiosyncratic) Component**: $R_{\text{stock\_specific}} = R_{\text{stock}} - (\beta_{60} \times R_{\text{NIFTY50}})$
    3. **Percentage Attribution**:
       $$\text{Market Attribution \%} = \frac{|R_{\text{market\_driven}}|}{|R_{\text{market\_driven}}| + |R_{\text{stock\_specific}}|} \times 100$$
       $$\text{Stock-Specific Attribution \%} = \frac{|R_{\text{stock\_specific}}|}{|R_{\text{market\_driven}}| + |R_{\text{stock\_specific}}|} \times 100$$
    4. Pass attribution results to `explanationService.js` for plain-language movement breakdown cards.
* **Whether It Can Be Reused Safely**:
  - N/A (New feature requiring integration of NIFTY 50 index data and rolling 60-day beta).

---

### 10. Show a Streamlit dashboard with watchlist table, charts, anomaly badges, and explanation cards
* **Status**: **Partially Implemented**
* **What Exists**:
  - A production React 19 + TypeScript + Vite + TailwindCSS dashboard exists with:
    - Watchlist table (`StockRow.tsx`, `Dashboard.tsx`)
    - Interactive historical charts via Recharts (`StockDetail.tsx`)
    - Color-coded tier & freshness badges (`TierSection.tsx`, `FreshnessBadge.tsx`)
    - Explanation cards & why-did-it-change drawers (`StockCard.tsx`, `StockRow.tsx`, `StockDetail.tsx`)
* **Which File / Function Contains It**:
  - `frontend/src/components/Dashboard.tsx`
  - `frontend/src/components/StockCard.tsx`
  - `frontend/src/components/StockRow.tsx`
  - `frontend/src/components/StockDetail.tsx`
  - `frontend/src/components/TierSection.tsx`
  - `frontend/src/components/FreshnessBadge.tsx`
* **What Must Be Added or Changed**:
  - *UI Capabilities*: Existing React SPA already renders tables, charts, badges, and explanation cards.
  - *Missing UI Metrics*:
    1. Z-Score breakdown indicators ($Z_{\text{return}}$, $Z_{\text{volume}}$, $Z_{\text{volatility}}$, Volume Ratio).
    2. Silent Signal badge ("Silent Signal: High Volume, Low Price Movement").
    3. Movement Attribution cards (Market-Driven % vs Stock-Specific % breakdown).
  - *Streamlit Requirement*: If building a Python Streamlit interface (e.g. `app.py` / Streamlit dashboard), build Python Streamlit view or connect Python calculation modules to the application backend.
* **Whether It Can Be Reused Safely**:
  - **Yes**, the existing React components (`StockCard`, `StockDetail`, `StockRow`, etc.) can be safely extended to display Z-scores, Silent Signals, and Attribution cards.

---

## Summary Matrix

| # | Target Feature | Implementation Status | Core File / Function | Primary Gap / Action Needed |
| :---: | :--- | :---: | :--- | :--- |
| **1** | Fetch daily OHLCV for NIFTY 50 stocks | **Partially Implemented** | `marketDataService.getHistoricalPrices()` | Expand daily OHLCV series to 60+ trading days; enforce NIFTY 50 stock selection. |
| **2** | Fetch NIFTY 50 index data | **Not Implemented** | N/A | Add fetching & caching for benchmark ticker `^NSEI`. |
| **3** | Calculate daily returns, 20d vol/volatility, 60d beta | **Partially Implemented** | `changeDetectionEngine.js` | Upgrade single-snapshot diffs to 20-day rolling averages/volatility and 60-day rolling beta. |
| **4** | Detect unusual price movement via return Z-Score | **Not Implemented** | `changeDetectionEngine.computePriceSignal()` | Replace 5% linear scaling with $Z_{\text{return}} = (R_t - \mu_{R,20}) / \sigma_{R,20}$. |
| **5** | Detect unusual volume via volume Z-Score & Volume Ratio | **Partially Implemented** | `changeDetectionEngine.computeVolumeSignal()` | Add Volume Ratio $V_t / \bar{V}_{20}$ and Volume Z-Score $Z_{\text{volume}}$. |
| **6** | Detect unusual volatility via volatility Z-Score | **Partially Implemented** | `changeDetectionEngine.computeVolatilitySignal()` | Replace 6% intraday range threshold with Volatility Z-Score $Z_{\text{volatility}}$. |
| **7** | Detect Silent Signal (High volume, small price move) | **Not Implemented** | N/A | Implement joint rule: High Volume ($Z_{\text{volume}} \ge 1.5$) + Low Return ($|R_t| \le 0.3\%$). |
| **8** | Calculate Anomaly Score (0 to 100) | **Partially Implemented** | `attentionRankingEngine.rankAttention()` | Update score computation to aggregate Z-scores and Silent Signal bonus into 0–100 scale. |
| **9** | Attribute movement (Market-Driven vs Stock-Specific) | **Not Implemented** | N/A | Calculate $R_{\text{market}} = \beta_{60} \times R_{\text{NIFTY50}}$ and $R_{\text{stock-specific}} = R_{\text{stock}} - R_{\text{market}}$. |
| **10**| Dashboard (Table, charts, badges, explanation cards) | **Partially Implemented** | `frontend/src/components/Dashboard.tsx` | Extend UI to display Z-scores, Silent Signal badges, and CAPM movement attribution cards. |
