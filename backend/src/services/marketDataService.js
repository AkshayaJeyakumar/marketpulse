/**
 * Yahoo Finance Market Data Service
 *
 * Uses Yahoo Finance's chart endpoint for NSE/BSE symbols.
 *
 * Important:
 * - No API key is required.
 * - NSE symbols use .NS
 * - BSE symbols use .BO
 * - Some companies have changed their ticker symbols.
 * - Freshness is calculated from the market timestamp.
 * - We never claim a quote is live when the timestamp is stale.
 */

import { withReliability } from './reliabilityService.js';

const YAHOO_BASE_URL =
  'https://query1.finance.yahoo.com/v8/finance/chart';


/*
 * ============================================================
 * SYMBOL MAPPING
 * ============================================================
 *
 * Some companies have changed their ticker/name.
 *
 * MarketPulse can continue storing the symbol that the
 * user originally searched for, while Yahoo receives
 * the current Yahoo Finance ticker.
 *
 * Example:
 *
 * ZOMATO
 *   -> ETERNAL.NS
 *
 * TATAMOTORS
 *   -> TMCV.NS
 */

const YAHOO_SYMBOL_MAP = {
  ZOMATO: 'ETERNAL.NS',
  TATAMOTORS: 'TMCV.NS',
};

const historyCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;


function cleanSymbol(symbol) {
  return String(symbol || '')
    .trim()
    .toUpperCase();
}


function getYahooSymbol(symbol) {
  const raw = String(symbol || '').trim();

  if (raw.startsWith('^')) {
    return raw.toUpperCase();
  }

  const normalized = raw.toUpperCase();

  if (!normalized) {
    return '';
  }

  if (normalized === 'NIFTY50' || normalized === 'NIFTY 50') {
    return '^NSEI';
  }

  /*
   * If the symbol is already a Yahoo Finance symbol,
   * don't add another exchange suffix.
   */
  if (
    normalized.endsWith('.NS') ||
    normalized.endsWith('.BO')
  ) {
    return normalized;
  }

  /*
   * Handle known ticker changes.
   */
  if (YAHOO_SYMBOL_MAP[normalized]) {
    return YAHOO_SYMBOL_MAP[normalized];
  }

  /*
   * MarketPulse currently stores Indian equity symbols
   * without the exchange suffix.
   *
   * Default to NSE.
   */
  return `${normalized}.NS`;
}


function getLastValue(values) {
  if (!Array.isArray(values)) {
    return null;
  }

  for (
    let i = values.length - 1;
    i >= 0;
    i -= 1
  ) {
    const value = Number(values[i]);

    if (Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}


/*
 * ============================================================
 * GET CURRENT QUOTE
 * ============================================================
 */

export async function getQuote(symbol) {
  const normalizedSymbol =
    cleanSymbol(symbol);

  return withReliability(async () => {
    const retrievedAt =
      new Date().toISOString();

    if (!normalizedSymbol) {
      return {
        symbol: normalizedSymbol,
        name: normalizedSymbol,
        status: 'unavailable',
        source: 'yahoo-finance',
        retrievedAt,
        marketTimestamp: null,
      };
    }

    /*
     * Convert the MarketPulse symbol into the
     * corresponding Yahoo Finance symbol.
     */
    const yahooSymbol =
      getYahooSymbol(normalizedSymbol);

    const url =
      `${YAHOO_BASE_URL}/` +
      `${encodeURIComponent(yahooSymbol)}` +
      `?interval=1m&range=1d`;

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 MarketPulse/1.0',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Yahoo Finance returned ${response.status}`
      );
    }

    const data =
      await response.json();

    const result =
      data?.chart?.result?.[0];

    /*
     * Yahoo returned no usable chart result.
     */
    if (!result) {
      return {
        symbol: normalizedSymbol,
        name: normalizedSymbol,
        status: 'unavailable',
        source: 'yahoo-finance',
        retrievedAt,
        marketTimestamp: null,
      };
    }

    const meta =
      result.meta || {};

    const quote =
      result.indicators?.quote?.[0] || {};

    const timestamps =
      Array.isArray(result.timestamp)
        ? result.timestamp
        : [];

    const prices =
      Array.isArray(quote.close)
        ? quote.close
        : [];

    const opens =
      Array.isArray(quote.open)
        ? quote.open
        : [];

    const highs =
      Array.isArray(quote.high)
        ? quote.high
        : [];

    const lows =
      Array.isArray(quote.low)
        ? quote.low
        : [];

    const volumes =
      Array.isArray(quote.volume)
        ? quote.volume
        : [];


    /*
     * Prefer Yahoo's regular market price.
     *
     * If it is unavailable, use the latest
     * chart closing price.
     */
    const regularMarketPrice =
      Number(meta.regularMarketPrice);

    const price =
      Number.isFinite(regularMarketPrice)
        ? regularMarketPrice
        : getLastValue(prices);


    /*
     * Previous trading-session close.
     */
    const previousClose =
      Number(meta.previousClose);

    const chartPreviousClose =
      Number(meta.chartPreviousClose);

    const prevClose =
      Number.isFinite(previousClose)
        ? previousClose
        : Number.isFinite(chartPreviousClose)
          ? chartPreviousClose
          : null;


    /*
     * Prefer Yahoo's market-level values
     * when available.
     *
     * Otherwise use chart data.
     */
    const regularMarketOpen =
      Number(meta.regularMarketOpen);

    const open =
      Number.isFinite(regularMarketOpen)
        ? regularMarketOpen
        : getLastValue(opens);


    const regularMarketDayHigh =
      Number(meta.regularMarketDayHigh);

    const dayHigh =
      Number.isFinite(regularMarketDayHigh)
        ? regularMarketDayHigh
        : getLastValue(highs);


    const regularMarketDayLow =
      Number(meta.regularMarketDayLow);

    const dayLow =
      Number.isFinite(regularMarketDayLow)
        ? regularMarketDayLow
        : getLastValue(lows);


    const regularMarketVolume =
      Number(meta.regularMarketVolume);

    const volume =
      Number.isFinite(regularMarketVolume)
        ? regularMarketVolume
        : getLastValue(volumes);


    /*
     * Yahoo returns regularMarketTime
     * as Unix seconds.
     */
    const regularMarketTime =
      Number(meta.regularMarketTime);

    const lastTimestamp =
      Number(
        timestamps[
          timestamps.length - 1
        ]
      );

    const marketTimestamp =
      Number.isFinite(regularMarketTime)
        ? new Date(
            regularMarketTime * 1000
          ).toISOString()
        : Number.isFinite(lastTimestamp)
          ? new Date(
              lastTimestamp * 1000
            ).toISOString()
          : null;


    /*
     * A valid quote requires both:
     *
     * 1. Current price
     * 2. Previous close
     */
    if (
      !Number.isFinite(price) ||
      !Number.isFinite(prevClose)
    ) {
      return {
        symbol: normalizedSymbol,

        name:
          meta.longName ||
          meta.shortName ||
          normalizedSymbol,

        status: 'unavailable',

        source: 'yahoo-finance',

        retrievedAt,

        marketTimestamp,
      };
    }


    /*
     * Return the normalized MarketPulse object.
     *
     * IMPORTANT:
     *
     * The original symbol is preserved.
     */
    return {
      symbol: normalizedSymbol,

      name:
        meta.longName ||
        meta.shortName ||
        normalizedSymbol,

      price,

      prevClose,

      dayHigh:
        Number.isFinite(dayHigh)
          ? dayHigh
          : price,

      dayLow:
        Number.isFinite(dayLow)
          ? dayLow
          : price,

      open:
        Number.isFinite(open)
          ? open
          : price,

      volume:
        Number.isFinite(volume)
          ? volume
          : 0,

      direction:
        price >= prevClose
          ? 'up'
          : 'down',

      source:
        'yahoo-finance',

      status:
        'ok',

      retrievedAt,

      marketTimestamp,

      currency:
        meta.currency ||
        'INR',

      exchange:
        meta.exchangeName ||
        meta.exchange ||
        'NSE',

      /*
       * Useful for debugging and transparency.
       */
      yahooSymbol,
    };
  });
}


/*
 * ============================================================
 * HISTORICAL DATA HELPERS
 * ============================================================
 */


/*
 * Convert a timestamp into an India calendar date.
 *
 * Example:
 *
 * 2026-09-04T09:15:00Z
 *       ->
 * 2026-09-04
 *
 * We use Asia/Kolkata because MarketPulse is dealing
 * with NSE market sessions.
 */
function getIndiaDate(timestamp) {
  const date =
    new Date(timestamp * 1000);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }
  ).format(date);
}


/*
 * Find the latest trading date represented
 * in the Yahoo response.
 *
 * This is important on weekends.
 *
 * Example:
 *
 * Today = Saturday
 *
 * Yahoo response may contain Friday's data.
 *
 * We identify Friday as the latest date and
 * use only Friday's intraday observations for
 * the 1D chart.
 */
function getLatestTradingDate(
  timestamps
) {
  const dates = [];

  for (const rawTimestamp of timestamps) {
    const timestamp =
      Number(rawTimestamp);

    if (!Number.isFinite(timestamp)) {
      continue;
    }

    const indiaDate =
      getIndiaDate(timestamp);

    if (indiaDate) {
      dates.push(indiaDate);
    }
  }

  if (dates.length === 0) {
    return null;
  }

  /*
   * ISO date strings sort correctly
   * chronologically.
   */
  dates.sort();

  return dates[dates.length - 1];
}


/*
 * ============================================================
 * GET HISTORICAL PRICES
 * ============================================================
 *
 * Used by the Stock Detail page.
 *
 * Supported ranges:
 *
 * 1d -> latest trading day, 5-minute candles
 * 1w -> last 5 trading days, 15-minute candles
 * 1m -> last month, daily candles
 *
 * All chart values come from Yahoo Finance.
 * No prices are hard-coded.
 */

export async function getHistoricalPrices(
  symbol,
  range = '1d'
) {
  const normalizedSymbol =
    cleanSymbol(symbol);

  const requestedRange =
    String(range || '1d').toLowerCase();

  const cacheKey = `${normalizedSymbol}:${requestedRange}`;

  if (normalizedSymbol) {
    const cached = historyCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const responseResult = await withReliability(async () => {
    const retrievedAt =
      new Date().toISOString();

    if (!normalizedSymbol) {
      return {
        symbol: normalizedSymbol,
        status: 'unavailable',
        source: 'yahoo-finance',
        retrievedAt,
        marketTimestamp: null,
        yahooSymbol: '',
        range: requestedRange,
        interval: '5m',
        points: [],
      };
    }


    /*
     * Convert MarketPulse symbol into
     * Yahoo Finance symbol.
     */
    const yahooSymbol =
      getYahooSymbol(normalizedSymbol);


    /*
     * ========================================================
     * RANGE CONFIGURATION
     * ========================================================
     */

    let yahooRange = '5d';
    let interval = '5m';

    if (requestedRange === '1w') {
      yahooRange = '5d';
      interval = '15m';
    } else if (requestedRange === '1m') {
      yahooRange = '1mo';
      interval = '1d';
    } else if (
      requestedRange === '90d' ||
      requestedRange === '3mo' ||
      requestedRange === '6mo'
    ) {
      yahooRange = '6mo';
      interval = '1d';
    }


    /*
     * Build Yahoo Finance historical URL.
     */
    const url =
      `${YAHOO_BASE_URL}/` +
      `${encodeURIComponent(yahooSymbol)}` +
      `?range=${yahooRange}` +
      `&interval=${interval}` +
      `&events=history` +
      `&includePrePost=false`;


    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 MarketPulse/1.0',
        Accept: 'application/json',
      },
    });


    if (!response.ok) {
      return {
        symbol: normalizedSymbol,
        status:
          response.status === 429
            ? 'rate_limited'
            : 'unavailable',
        source: 'yahoo-finance',
        retrievedAt,
        marketTimestamp: null,
        yahooSymbol,
        range: requestedRange,
        interval,
        points: [],
        error: `Yahoo Finance returned ${response.status}`,
      };
    }


    const data =
      await response.json();


    const result =
      data?.chart?.result?.[0];


    /*
     * Yahoo returned no historical data.
     */
    if (!result) {
      return {
        symbol: normalizedSymbol,
        status: 'unavailable',
        source: 'yahoo-finance',
        retrievedAt,
        marketTimestamp: null,
        yahooSymbol,
        range: requestedRange,
        interval,
        points: [],
      };
    }


    /*
     * Yahoo sometimes provides arrays containing
     * null values.
     *
     * Normalize everything safely.
     */
    const timestamps =
      Array.isArray(result.timestamp)
        ? result.timestamp
        : [];


    const quote =
      result.indicators?.quote?.[0] || {};


    const closes =
      Array.isArray(quote.close)
        ? quote.close
        : [];


    const opens =
      Array.isArray(quote.open)
        ? quote.open
        : [];


    const highs =
      Array.isArray(quote.high)
        ? quote.high
        : [];


    const lows =
      Array.isArray(quote.low)
        ? quote.low
        : [];


    const volumes =
      Array.isArray(quote.volume)
        ? quote.volume
        : [];


    /*
     * ========================================================
     * DETERMINE LATEST TRADING DAY
     * ========================================================
     *
     * Only needed for 1D.
     */
    const latestTradingDate =
      requestedRange === '1d'
        ? getLatestTradingDate(
            timestamps
          )
        : null;


    const points = [];


    /*
     * ========================================================
     * BUILD CLEAN POINTS
     * ========================================================
     */
    for (
      let i = 0;
      i < timestamps.length;
      i += 1
    ) {

      const timestamp =
        Number(timestamps[i]);


      const close =
        Number(closes[i]);


      /*
       * Skip invalid/null timestamps and prices.
       */
      if (
        !Number.isFinite(timestamp) ||
        !Number.isFinite(close) ||
        close <= 0
      ) {
        continue;
      }


      const date =
        new Date(
          timestamp * 1000
        );


      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        continue;
      }


      /*
       * For 1D, only keep the latest actual
       * trading date.
       */
      if (requestedRange === '1d') {
        const indiaDate =
          getIndiaDate(timestamp);

        if (
          indiaDate !==
          latestTradingDate
        ) {
          continue;
        }
      }


      const openValue =
        Number(opens[i]);


      const highValue =
        Number(highs[i]);


      const lowValue =
        Number(lows[i]);


      const volumeValue =
        Number(volumes[i]);


      points.push({
        timestamp:
          date.toISOString(),

        price:
          close,

        open:
          Number.isFinite(openValue)
            ? openValue
            : null,

        high:
          Number.isFinite(highValue)
            ? highValue
            : null,

        low:
          Number.isFinite(lowValue)
            ? lowValue
            : null,

        volume:
          Number.isFinite(volumeValue)
            ? volumeValue
            : null,
      });
    }


    /*
     * ========================================================
     * SORT CHRONOLOGICALLY
     * ========================================================
     */
    points.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() -
        new Date(b.timestamp).getTime()
    );


    /*
     * ========================================================
     * REMOVE DUPLICATE TIMESTAMPS
     * ========================================================
     */
    const uniquePoints = [];

    const seenTimestamps =
      new Set();


    for (const point of points) {

      if (
        seenTimestamps.has(
          point.timestamp
        )
      ) {
        continue;
      }


      seenTimestamps.add(
        point.timestamp
      );


      uniquePoints.push(point);
    }


    /*
     * For 90d / 3mo, return at least the 90 most recent candles
     * (or all available daily candles if fewer than 90).
     */
    let finalPoints = uniquePoints;

    if (
      requestedRange === '90d' ||
      requestedRange === '3mo'
    ) {
      if (uniquePoints.length > 90) {
        finalPoints = uniquePoints.slice(uniquePoints.length - 90);
      }
    }


    const marketTimestamp =
      Number.isFinite(
        Number(
          result.meta?.regularMarketTime
        )
      )
        ? new Date(
            Number(
              result.meta.regularMarketTime
            ) * 1000
          ).toISOString()
        : finalPoints.length > 0
          ? finalPoints[
              finalPoints.length - 1
            ].timestamp
          : null;


    /*
     * ========================================================
     * RETURN NORMALIZED RESPONSE
     * ========================================================
     */
    return {

      symbol:
        normalizedSymbol,


      name:
        result.meta?.longName ||
        result.meta?.shortName ||
        normalizedSymbol,


      status:
        finalPoints.length > 0
          ? 'ok'
          : 'unavailable',


      source:
        'yahoo-finance',


      retrievedAt,


      marketTimestamp,


      yahooSymbol,


      range:
        requestedRange,


      interval,


      points:
        finalPoints,
    };
  });

  if (
    normalizedSymbol &&
    responseResult &&
    (responseResult.status === 'ok' ||
      (Array.isArray(responseResult.points) &&
        responseResult.points.length > 0))
  ) {
    historyCache.set(cacheKey, {
      timestamp: Date.now(),
      data: responseResult,
    });
  }

  return responseResult;
}


export async function getBenchmarkHistory(
  range = '3mo'
) {
  return getHistoricalPrices('^NSEI', range);
}


/*
 * ============================================================
 * COMPATIBILITY FUNCTIONS
 * ============================================================
 *
 * Kept for compatibility with the existing
 * MarketPulse architecture.
 *
 * We are no longer using mock previous views
 * for market data.
 */

export async function getMockPreviousView() {
  return null;
}


export function listMockSymbols() {
  return [];
}