# MarketPulse

> **Know what changed. Know what matters.**

An attention engine for market watchlists, built for **Code, by Groww**.

MarketPulse goes beyond simply displaying a watchlist. It identifies meaningful changes since the user last checked, ranks what deserves attention, and explains why a stock was flagged.

---

## 🎯 Problem

Traditional watchlists tell users **what is happening now**, but they do not answer:

- What changed since I last checked?
- Which changes actually matter?
- Why should I pay attention to this stock?
- Is the market data fresh or delayed?
- What other stocks might be relevant to my watchlist?

MarketPulse is designed to answer these questions without turning the product into a buy/sell recommendation system.

---

## 💡 Solution

MarketPulse combines:

- 📊 **Watchlist management**
- 🔍 **Change detection**
- 🧠 **Attention ranking**
- 💬 **Explainable market signals**
- ⚡ **Market-data freshness and reliability**
- 👤 **User authentication**
- 🎯 **Personalized watchlist suggestions**
- 📈 **Stock details and historical market data**
- 🌗 **Light and dark themes**

The core experience is:

> **Know what changed. Know what matters.**

---

## ✨ Key Features

### 1. Smart Watchlist

Users can create and manage their personal watchlist.

Stocks can be:

- Added
- Removed
- Viewed
- Opened for detailed analysis

Watchlist data is persisted through the backend and database rather than relying only on browser state.

---

### 2. "What Changed?" Dashboard

Instead of showing every stock with equal importance, MarketPulse organizes stocks into attention tiers:

- 🔴 **Significant**
- 🟡 **Worth Watching**
- ⚪ **Normal**

This helps reduce information overload and focuses the user's attention on meaningful changes.

---

### 3. Change Detection Engine

MarketPulse compares market observations and identifies changes in:

- Price
- Trading volume
- Volatility

Signals are converted into an attention score using configurable weights.

The current default weighting is:

```text
Price       50%
Volume      30%
Volatility  20%