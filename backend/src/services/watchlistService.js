/**
 * MarketPulse Watchlist Service
 *
 * Responsibilities:
 * - Read the user's persisted watchlist
 * - Fetch current real market data
 * - Compare it with the user's last acknowledged snapshot
 * - Calculate attention
 * - Generate explanations
 * - Save a snapshot ONLY when the user acknowledges the view
 */

import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { getQuote, getHistoricalPrices, getBenchmarkHistory } from './marketDataService.js';
import { pool, query } from '../db/database.js';
import { computeSignals } from './changeDetectionEngine.js';
import { rankAttention } from './attentionRankingEngine.js';
import { buildExplanation } from './explanationService.js';
import { computeStockStatistics } from './statisticalAnalysisService.js';
import { evaluateAnomalies } from './anomalyDetectionEngine.js';
import { config } from '../config/index.js';

// Replicate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WATCHLIST_NAME = 'My Watchlist';

/**
 * Asynchronously triggers the Python FinBERT ML worker in the background
 * whenever a new stock is added to the watchlist.
 */
function triggerMlSentimentWorker(ticker) {
  try {
    // Path to the python executable in your virtual environment
    const pythonExe = path.join(__dirname, '../../../ml_service/venv/Scripts/python.exe');
    const scriptPath = path.join(__dirname, '../../../ml_service/sentiment_worker.py');

    const command = `"${pythonExe}" "${scriptPath}" --ticker ${ticker}`;

    console.log(`[ML Worker] Triggering background sentiment analysis for ${ticker}...`);

    // Run it asynchronously so it doesn't block the API response to the user
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`[ML Worker] Failed to analyze ${ticker}:`, error.message);
        return;
      }
      if (stderr) {
        console.error(`[ML Worker] ${ticker} stderr:`, stderr);
      }
      console.log(`[ML Worker] Successfully finished analyzing ${ticker}`);
    });
  } catch (err) {
    console.error(`[ML Worker] Error setting up worker for ${ticker}:`, err.message);
  }
}

/**
 * Get symbols in the authenticated user's watchlist.
 */
async function getWatchlistSymbols(userId) {
  const result = await query(
    `SELECT ws.symbol
     FROM watchlists w
     JOIN watchlist_stocks ws
       ON ws.watchlist_id = w.id
     WHERE w.user_id = $1
       AND w.name = $2
     ORDER BY ws.symbol`,
    [userId, WATCHLIST_NAME]
  );

  return result.rows.map((row) => row.symbol);
}
/**
 * Get the latest saved snapshot for each symbol.
 */
async function getPreviousSnapshots(userId, symbols) {
  if (symbols.length === 0) {
    return new Map();
  }

  const result = await query(
    `SELECT DISTINCT ON (symbol)
       symbol,
       price,
       volume,
       freshness,
       viewed_at
     FROM market_snapshots
     WHERE user_id = $1
       AND symbol = ANY($2::text[])
     ORDER BY symbol, viewed_at DESC`,
    [userId, symbols]
  );

  return new Map(
    result.rows.map((row) => [
      row.symbol,
      {
        symbol: row.symbol,
        price: Number(row.price),
        volume: Number(row.volume),
        freshness: row.freshness,
        viewedAt: row.viewed_at,
      },
    ])
  );
}

/**
 * Default sentiment structure used when no news has been analyzed for a stock.
 */
function getFallbackSentiment() {
  return {
    aggregateScore: 0.0,
    sentimentLabel: 'Neutral',
    articleCount: 0,
    headlines: [],
    mlForecast: {
      baselineAccuracy: 51.4,
      enhancedAccuracy: 58.7,
      accuracyLift: 7.3,
      f1Baseline: 0.491,
      f1Enhanced: 0.573,
      model: 'RandomForest (TimeSeriesSplit, n=3)',
    },
  };
}

/**
 * Batch-fetch latest aggregated news sentiment and top 3 headlines from PostgreSQL `news_sentiment`.
 */
export async function fetchSentimentForSymbols(symbols) {
  if (!symbols || symbols.length === 0) {
    return new Map();
  }

  try {
    const cleanSymbols = symbols.map((s) => s.toUpperCase());
    const baseSymbols = cleanSymbols.map((s) => s.split('.')[0]);
    const allLookupSymbols = Array.from(new Set([...cleanSymbols, ...baseSymbols]));

    const result = await query(
      `WITH ranked_news AS (
         SELECT 
           ticker,
           headline,
           sentiment_label,
           signed_score,
           source_url,
           published_at,
           impact_assessment,
           ROW_NUMBER() OVER (
             PARTITION BY ticker 
             ORDER BY published_at DESC
           ) AS rn
         FROM news_sentiment
         WHERE UPPER(ticker) = ANY($1::text[])
            OR UPPER(split_part(ticker, '.', 1)) = ANY($1::text[])
       ),
       agg_sentiment AS (
         SELECT 
           ticker,
           AVG(signed_score)::numeric(5, 4) AS avg_signed_score,
           COUNT(*) AS article_count
         FROM news_sentiment
         WHERE UPPER(ticker) = ANY($1::text[])
            OR UPPER(split_part(ticker, '.', 1)) = ANY($1::text[])
         GROUP BY ticker
       )
       SELECT 
         r.ticker,
         r.headline,
         r.sentiment_label,
         r.signed_score,
         r.source_url,
         r.published_at,
         r.impact_assessment,
         a.avg_signed_score,
         a.article_count
       FROM ranked_news r
       JOIN agg_sentiment a ON a.ticker = r.ticker
       WHERE r.rn <= 3
       ORDER BY r.ticker, r.published_at DESC`,
      [allLookupSymbols]
    );

    const sentimentMap = new Map();

    for (const row of result.rows) {
      const sym = row.ticker.toUpperCase();
      const baseSym = sym.split('.')[0];

      if (!sentimentMap.has(sym)) {
        const avgScore = Number(row.avg_signed_score) || 0;
        let tone = 'Neutral';
        if (avgScore >= 0.15) {
          tone = 'Positive';
        } else if (avgScore <= -0.15) {
          tone = 'Negative';
        }

        sentimentMap.set(sym, {
          aggregateScore: avgScore,
          sentimentLabel: tone,
          articleCount: Number(row.article_count) || 0,
          headlines: [],
          mlForecast: {
            baselineAccuracy: 51.4,
            enhancedAccuracy: 58.7,
            accuracyLift: 7.3,
            f1Baseline: 0.491,
            f1Enhanced: 0.573,
            model: 'RandomForest (TimeSeriesSplit, n=3)',
          },
        });
      }

      const item = sentimentMap.get(sym);
      item.headlines.push({
        headline: row.headline,
        sentimentLabel: row.sentiment_label,
        signedScore: Number(row.signed_score),
        sourceUrl: row.source_url,
        publishedAt: row.published_at,
        impact_assessment: row.impact_assessment || null,
      });

      if (!sentimentMap.has(baseSym)) {
        sentimentMap.set(baseSym, item);
      }
    }

    return sentimentMap;
  } catch (error) {
    console.error('Failed to fetch news sentiment from PostgreSQL:', error.message);
    return new Map();
  }
}

/**
 * Single stock sentiment lookup.
 */
export async function getNewsSentimentForStock(symbol) {
  const map = await fetchSentimentForSymbols([symbol]);
  return (
    map.get(symbol.toUpperCase()) ||
    map.get(symbol.split('.')[0].toUpperCase()) ||
    getFallbackSentiment()
  );
}

/**
 * Fetch current market data, calculate statistical metrics, and run anomaly detection.
 */
async function buildCurrentItems(symbols, previousBySymbol) {
  let benchmarkData = null;
  try {
    benchmarkData = await getBenchmarkHistory('3mo');
  } catch (err) {
    console.error('Failed to fetch benchmark history for anomaly analysis:', err.message);
  }

  const sentimentBySymbol = await fetchSentimentForSymbols(symbols);

  return Promise.all(
    symbols.map(async (symbol) => {
      const previous = previousBySymbol.get(symbol) || null;
      const stockSentiment =
        sentimentBySymbol.get(symbol.toUpperCase()) ||
        sentimentBySymbol.get(symbol.split('.')[0].toUpperCase()) ||
        getFallbackSentiment();

      try {
        if (config.marketDataProvider !== 'yahoo') {
          throw new Error(`Unsupported market data provider: ${config.marketDataProvider}`);
        }

        const current = await getQuote(symbol);

        if (current.status !== 'ok') {
          return {
            symbol,
            name: current.name || symbol,
            status: current.status || 'unavailable',
            freshness: current.freshness || 'unavailable',
            source: current.source || 'yahoo-finance',
            retrievedAt: current.retrievedAt,
            marketTimestamp: current.marketTimestamp,
            anomalyScore: 0,
            anomalyStatus: 'Normal Activity',
            volumeRatio: 1,
            returnZScore: 0,
            volumeZScore: 0,
            volatilityZScore: 0,
            isSilentSignal: false,
            summaryText: 'Market data unavailable for anomaly analysis.',
            tier: 'normal',
            attentionScore: 0,
            reasons: ['Market data is currently unavailable for this stock.'],
            explanation: 'MarketPulse could not calculate a meaningful change because current market data is unavailable.',
            explanationDisclaimer: 'This is an observation of market activity, not investment advice or a prediction.',
            lastViewedAt: previous?.viewedAt || null,
            priceChangeSinceLastView: null,
            volumeChangeSinceLastView: null,
            sentiment: stockSentiment,
          };
        }

        const stockData = await getHistoricalPrices(symbol, '3mo');

        let anomalyScore = 0;
        let anomalyStatus = 'Normal Activity';
        let volumeRatio = 1;
        let returnZScore = 0;
        let volumeZScore = 0;
        let volatilityZScore = 0;
        let isSilentSignal = false;
        let summaryText = 'Normal activity consistent with baseline parameters.';
        let tier = 'normal';
        let attentionScore = 0;
        let explanation = {
          summary: 'Normal activity consistent with baseline parameters.',
          reasons: ['No unusual activity detected.'],
          disclaimer: 'This is an observation of market activity, not investment advice or a prediction.',
        };
        let metrics = null;
        let anomalyResult = null;

        if (
          stockData.status === 'ok' &&
          benchmarkData?.status === 'ok' &&
          Array.isArray(stockData.points) &&
          stockData.points.length >= 20 &&
          Array.isArray(benchmarkData.points) &&
          benchmarkData.points.length >= 20
        ) {
          metrics = computeStockStatistics(stockData.points, benchmarkData.points);
          anomalyResult = evaluateAnomalies(metrics);

          const ranking = rankAttention(anomalyResult.anomalyScore);
          attentionScore = ranking.attentionScore;
          tier = ranking.tier;

          anomalyScore = anomalyResult.anomalyScore;
          anomalyStatus = anomalyResult.anomalyStatus;
          volumeRatio = metrics.volumeRatio;
          returnZScore = metrics.returnZScore;
          volumeZScore = metrics.volumeZScore;
          volatilityZScore = metrics.volatilityZScore;
          isSilentSignal = anomalyResult.isSilentSignal;
          summaryText = anomalyResult.summaryText;

          explanation = buildExplanation(summaryText, current, attentionScore);
        } else {
          const signals = computeSignals(previous, current);
          const fallbackRanking = rankAttention(signals);
          attentionScore = fallbackRanking.attentionScore;
          tier = fallbackRanking.tier;
          explanation = buildExplanation(signals, current, attentionScore);
        }

        const priceChangeSinceLastView =
          previous && Number.isFinite(previous.price) && previous.price > 0
            ? ((current.price - previous.price) / previous.price) * 100
            : null;

        const volumeChangeSinceLastView =
          previous && Number.isFinite(previous.volume) && previous.volume > 0
            ? ((current.volume - previous.volume) / previous.volume) * 100
            : null;

        const marketSharePct = metrics?.marketSharePct ?? null;
        const stockSharePct = metrics?.stockSharePct ?? null;
        const attributionStatus = metrics?.attributionStatus ?? 'insufficient_data';

        return {
          symbol,
          name: current.name,
          price: current.price,
          prevClose: current.prevClose,
          priceChangeSinceLastView,
          volumeChangeSinceLastView,
          lastViewedAt: previous?.viewedAt || null,
          direction: current.direction,
          volume: current.volume,
          status: current.status,
          freshness: current.freshness,
          source: current.source,
          retrievedAt: current.retrievedAt,
          marketTimestamp: current.marketTimestamp,
          anomalyScore,
          anomalyStatus,
          volumeRatio,
          returnZScore,
          volumeZScore,
          volatilityZScore,
          isSilentSignal,
          summaryText,
          marketSharePct,
          stockSharePct,
          attributionStatus,
          attentionScore,
          tier,
          reasons: explanation.reasons,
          explanation: explanation.summary,
          explanationDisclaimer: explanation.disclaimer,
          sentiment: stockSentiment,
        };
      } catch (error) {
        console.error(`Market data failed for ${symbol}:`, error.message);

        return {
          symbol,
          name: symbol,
          status: 'error',
          freshness: 'unavailable',
          source: 'yahoo-finance',
          retrievedAt: new Date().toISOString(),
          marketTimestamp: null,
          anomalyScore: 0,
          anomalyStatus: 'Normal Activity',
          volumeRatio: 1,
          returnZScore: 0,
          volumeZScore: 0,
          volatilityZScore: 0,
          isSilentSignal: false,
          summaryText: 'Market data unavailable for anomaly analysis.',
          marketSharePct: null,
          stockSharePct: null,
          attributionStatus: 'insufficient_data',
          tier: 'normal',
          attentionScore: 0,
          reasons: ['Market data could not be retrieved right now.'],
          explanation: 'MarketPulse could not calculate anomaly metrics because the market-data provider is unavailable.',
          explanationDisclaimer: 'This is an observation of market activity, not investment advice or a prediction.',
          lastViewedAt: previous?.viewedAt || null,
          priceChangeSinceLastView: null,
          volumeChangeSinceLastView: null,
          sentiment: stockSentiment,
        };
      }
    })
  );
}

/**
 * Sort stocks by attention.
 */
function sortItems(items) {
  const tierOrder = {
    significant: 0,
    worth_watching: 1,
    normal: 2,
  };

  return [...items].sort((a, b) => {
    if (tierOrder[a.tier] !== tierOrder[b.tier]) {
      return tierOrder[a.tier] - tierOrder[b.tier];
    }
    return b.attentionScore - a.attentionScore;
  });
}

/**
 * Build watchlist summary.
 */
function buildSummary(items) {
  return {
    significant: items.filter((item) => item.tier === 'significant').length,
    worthWatching: items.filter((item) => item.tier === 'worth_watching').length,
    normal: items.filter((item) => item.tier === 'normal').length,
  };
}

/**
 * GET /api/watchlist
 */
export async function getWatchlistView(userId) {
  const symbols = await getWatchlistSymbols(userId);

  if (symbols.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      items: [],
      summary: { significant: 0, worthWatching: 0, normal: 0 },
    };
  }

  const previousBySymbol = await getPreviousSnapshots(userId, symbols);
  const items = await buildCurrentItems(symbols, previousBySymbol);
  const cleanItems = sortItems(items);

  return {
    generatedAt: new Date().toISOString(),
    items: cleanItems,
    summary: buildSummary(cleanItems),
  };
}

/**
 * POST /api/watchlist/view
 */
export async function saveCurrentWatchlistView(userId) {
  const symbols = await getWatchlistSymbols(userId);

  if (symbols.length === 0) {
    return { saved: 0, savedAt: new Date().toISOString() };
  }

  const currentItems = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        if (config.marketDataProvider !== 'yahoo') {
          throw new Error(`Unsupported market data provider: ${config.marketDataProvider}`);
        }

        const current = await getQuote(symbol);

        if (current.status !== 'ok' || !Number.isFinite(current.price)) {
          return null;
        }

        return {
          symbol,
          price: current.price,
          volume: current.volume,
          freshness: current.freshness,
        };
      } catch (error) {
        console.error(`Unable to save snapshot for ${symbol}:`, error.message);
        return null;
      }
    })
  );

  const validItems = currentItems.filter(Boolean);

  if (validItems.length === 0) {
    return {
      saved: 0,
      savedAt: new Date().toISOString(),
      message: 'No valid market data was available to save.',
    };
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const item of validItems) {
      await client.query(
        `INSERT INTO market_snapshots (user_id, symbol, price, volume, freshness, viewed_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [userId, item.symbol, item.price, item.volume, item.freshness]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return { saved: validItems.length, savedAt: new Date().toISOString() };
}

/**
 * Add a dynamically discovered stock.
 */
/**
 * Add a dynamically discovered stock.
 */
export async function addStockToWatchlist({ userId, symbol, name, exchange, currency }) {
  const normalizedSymbol = symbol.trim().toUpperCase();

  const normalizedName = typeof name === 'string' && name.trim() ? name.trim() : normalizedSymbol;

  const watchlistResult = await query(
    `SELECT id FROM watchlists WHERE user_id = $1 AND name = $2`,
    [userId, WATCHLIST_NAME]
  );

  const watchlistId = watchlistResult.rows[0]?.id;

  if (!watchlistId) {
    throw new Error('Watchlist not found');
  }

  let normalizedExchange = null;

  if (typeof exchange === 'string') {
    if (exchange.toLowerCase().includes('bombay')) {
      normalizedExchange = 'BSE';
    } else if (exchange.toLowerCase().includes('nse')) {
      normalizedExchange = 'NSE';
    } else {
      normalizedExchange = exchange.trim();
    }
  }

  await query(
    `INSERT INTO stock_metadata (symbol, name, exchange)
     VALUES ($1, $2, $3)
     ON CONFLICT (symbol) DO UPDATE SET
       name = EXCLUDED.name,
       exchange = COALESCE(EXCLUDED.exchange, stock_metadata.exchange)`,
    [normalizedSymbol, normalizedName, normalizedExchange]
  );

  const result = await query(
    `INSERT INTO watchlist_stocks (watchlist_id, symbol)
     VALUES ($1, $2)
     ON CONFLICT (watchlist_id, symbol) DO NOTHING
     RETURNING symbol`,
    [watchlistId, normalizedSymbol]
  );

  // 🚀 ALWAYS TRIGGER THE WORKER when this endpoint is called.
  // We do this regardless of 'result.rows.length' to ensure fresh news 
  // is fetched even if the stock was previously in the list and re-added.
  triggerMlSentimentWorker(normalizedSymbol);

  return {
    symbol: normalizedSymbol,
    name: normalizedName,
    exchange: normalizedExchange,
    currency: currency || null,
    added: result.rows.length > 0,
  };
}
/**
 * Remove a stock from the watchlist.
 */
export async function removeStockFromWatchlist(userId, symbol) {
  const normalizedSymbol = symbol.trim().toUpperCase();

  const watchlistResult = await query(
    `SELECT id FROM watchlists WHERE user_id = $1 AND name = $2`,
    [userId, WATCHLIST_NAME]
  );

  const watchlistId = watchlistResult.rows[0]?.id;

  if (!watchlistId) {
    throw new Error('Watchlist not found');
  }

  const result = await query(
    `DELETE FROM watchlist_stocks WHERE watchlist_id = $1 AND symbol = $2 RETURNING symbol`,
    [watchlistId, normalizedSymbol]
  );

  return {
    symbol: normalizedSymbol,
    removed: result.rows.length > 0,
  };
}