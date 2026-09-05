/**
 * Demo Market Data Service
 *
 * Generates deterministic simulated market movements.
 *
 * IMPORTANT:
 * This is demonstration data only.
 * It must never be presented as live market data.
 *
 * The service supports ANY symbol so stocks discovered
 * through the dynamic instrument search can also appear
 * in the dashboard.
 */

const PHASE_DURATION_MS = 20 * 1000;

const KNOWN_STOCKS = {
  TCS: {
    name: 'Tata Consultancy Services',
    basePrice: 2312,
    baseVolume: 1416000,
  },

  INFY: {
    name: 'Infosys',
    basePrice: 1450,
    baseVolume: 1408000,
  },

  RELIANCE: {
    name: 'Reliance Industries',
    basePrice: 1301.05,
    baseVolume: 1680000,
  },

  TATAMOTORS: {
    name: 'Tata Motors',
    basePrice: 720,
    baseVolume: 1480000,
  },

  HDFCBANK: {
    name: 'HDFC Bank',
    basePrice: 950,
    baseVolume: 1404000,
  },

  ITC: {
    name: 'ITC Limited',
    basePrice: 262.15,
    baseVolume: 2016000,
  },

  ZOMATO: {
    name: 'Eternal',
    basePrice: 320,
    baseVolume: 1312000,
  },

  ADANIENT: {
    name: 'Adani Enterprises',
    basePrice: 2886,
    baseVolume: 1548000,
  },

  SBIN: {
    name: 'State Bank of India',
    basePrice: 820,
    baseVolume: 1250000,
  },

  ICICIBANK: {
    name: 'ICICI Bank',
    basePrice: 1420,
    baseVolume: 1180000,
  },

  HINDUNILVR: {
    name: 'Hindustan Unilever',
    basePrice: 2650,
    baseVolume: 950000,
  },

  LT: {
    name: 'Larsen & Toubro',
    basePrice: 3650,
    baseVolume: 880000,
  },
};

function hashSymbol(symbol) {
  let hash = 0;

  for (let i = 0; i < symbol.length; i += 1) {
    hash =
      (hash * 31 +
        symbol.charCodeAt(i)) %
      100000;
  }

  return hash;
}

function createDynamicStock(symbol) {
  const hash = hashSymbol(symbol);

  /*
   * Produce a stable base price between
   * roughly ₹100 and ₹3,500.
   */
  const basePrice =
    100 + (hash % 3400);

  /*
   * Produce a stable volume between
   * 500k and 2.5M.
   */
  const baseVolume =
    500000 +
    (hash % 2000000);

  return {
    name: symbol,
    basePrice,
    baseVolume,
  };
}

function getStock(symbol) {
  const normalized =
    symbol.trim().toUpperCase();

  return (
    KNOWN_STOCKS[normalized] ||
    createDynamicStock(normalized)
  );
}

function getPhase() {
  return (
    Math.floor(
      Date.now() /
        PHASE_DURATION_MS
    ) % 3
  ) + 1;
}

function getMovement(
  symbol,
  phase
) {
  const hash =
    hashSymbol(symbol);

  /*
   * Each stock gets a stable movement pattern.
   * The same symbol always produces the same
   * sequence, which makes the demo reproducible.
   */

  const direction =
    hash % 2 === 0
      ? 1
      : -1;

  const strength =
    0.4 +
    ((hash % 7) / 10);

  const patterns = {
    1: {
      price: 0.002,
      volume: 0.05,
    },

    2: {
      price:
        0.006 * strength,
      volume:
        0.25 + (hash % 20) / 100,
    },

    3: {
      price:
        0.012 * strength,
      volume:
        0.45 + (hash % 30) / 100,
    },
  };

  const pattern =
    patterns[phase];

  return {
    priceChange:
      direction *
      pattern.price,

    volumeChange:
      pattern.volume,
  };
}

export async function getDemoQuote(
  symbol
) {
  const normalized =
    symbol?.trim().toUpperCase();

  if (!normalized) {
    return {
      symbol: '',
      name: '',
      status: 'unavailable',
      freshness: 'unavailable',
      source: 'demo-replay',
      demo: true,
      retrievedAt:
        new Date().toISOString(),
      marketTimestamp: null,
    };
  }

  const stock =
    getStock(normalized);

  const phase =
    getPhase();

  const movement =
    getMovement(
      normalized,
      phase
    );

  const price =
    stock.basePrice *
    (1 + movement.priceChange);

  const volume = Math.round(
    stock.baseVolume *
      (1 + movement.volumeChange)
  );

  const prevClose =
    stock.basePrice;

  const dayRange =
    Math.abs(
      price - prevClose
    ) * 1.8;

  const dayHigh =
    Math.max(
      price,
      prevClose +
        dayRange
    );

  const dayLow =
    Math.min(
      price,
      prevClose -
        dayRange
    );

  const direction =
    price >= prevClose
      ? 'up'
      : 'down';

  const now =
    new Date().toISOString();

  return {
    symbol: normalized,

    name: stock.name,

    price: Number(
      price.toFixed(2)
    ),

    prevClose: Number(
      prevClose.toFixed(2)
    ),

    dayHigh: Number(
      dayHigh.toFixed(2)
    ),

    dayLow: Number(
      Math.max(
        0,
        dayLow
      ).toFixed(2)
    ),

    open: Number(
      prevClose.toFixed(2)
    ),

    volume,

    direction,

    source: 'demo-replay',

    status: 'ok',

    freshness: 'recent',

    demo: true,

    replayPhase: phase,

    retrievedAt: now,

    marketTimestamp: now,
  };
}

export async function getMockPreviousView(
  symbol
) {
  return null;
}

export function listMockSymbols() {
  return Object.keys(
    KNOWN_STOCKS
  );
}