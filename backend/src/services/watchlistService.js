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

import { getQuote } from './marketDataService.js';
import { pool, query } from '../db/database.js';
import { computeSignals } from './changeDetectionEngine.js';
import { rankAttention } from './attentionRankingEngine.js';
import { buildExplanation } from './explanationService.js';
import { config } from '../config/index.js';

const WATCHLIST_NAME = 'My Watchlist';

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
 *
 * This is the user's last acknowledged view.
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
 * Fetch current market data and calculate changes.
 *
 * IMPORTANT:
 * This function NEVER writes to the database.
 */
async function buildCurrentItems(symbols, previousBySymbol) {
  return Promise.all(
    symbols.map(async (symbol) => {
      const previous =
        previousBySymbol.get(symbol) || null;

      let current;

      try {
        if (config.marketDataProvider !== 'yahoo') {
          throw new Error(
            `Unsupported market data provider: ${config.marketDataProvider}`
          );
        }

        current = await getQuote(symbol);
      } catch (error) {
        console.error(
          `Market data failed for ${symbol}:`,
          error.message
        );

        return {
          symbol,
          name: symbol,
          status: 'error',
          freshness: 'unavailable',
          source: 'yahoo-finance',
          retrievedAt: new Date().toISOString(),
          marketTimestamp: null,
          tier: 'normal',
          attentionScore: 0,
          reasons: [
            'Market data could not be retrieved right now.',
          ],
          explanation:
            'MarketPulse could not calculate a meaningful change because the market-data provider is unavailable.',
          explanationDisclaimer:
            'This is an observation of market activity, not investment advice or a prediction.',
          lastViewedAt:
            previous?.viewedAt || null,
          priceChangeSinceLastView: null,
          volumeChangeSinceLastView: null,
        };
      }

      if (current.status !== 'ok') {
        return {
          symbol,
          name: current.name || symbol,
          status: current.status || 'unavailable',
          freshness:
            current.freshness || 'unavailable',
          source:
            current.source || 'yahoo-finance',
          retrievedAt: current.retrievedAt,
          marketTimestamp: current.marketTimestamp,
          tier: 'normal',
          attentionScore: 0,
          reasons: [
            'Market data is currently unavailable for this stock.',
          ],
          explanation:
            'MarketPulse could not calculate a meaningful change because current market data is unavailable.',
          explanationDisclaimer:
            'This is an observation of market activity, not investment advice or a prediction.',
          lastViewedAt:
            previous?.viewedAt || null,
          priceChangeSinceLastView: null,
          volumeChangeSinceLastView: null,
        };
      }

      const signals = computeSignals(
        previous,
        current
      );

      const {
        attentionScore,
        tier,
      } = rankAttention(signals);

      const explanation =
        buildExplanation(
          signals,
          current,
          attentionScore
        );

      const priceChangeSinceLastView =
        previous &&
        Number.isFinite(previous.price) &&
        previous.price > 0
          ? (
              (
                (current.price - previous.price) /
                previous.price
              ) * 100
            )
          : null;

      const volumeChangeSinceLastView =
        previous &&
        Number.isFinite(previous.volume) &&
        previous.volume > 0
          ? (
              (
                (current.volume - previous.volume) /
                previous.volume
              ) * 100
            )
          : null;

      return {
        symbol,
        name: current.name,
        price: current.price,
        prevClose: current.prevClose,

        priceChangeSinceLastView,
        volumeChangeSinceLastView,

        lastViewedAt:
          previous?.viewedAt || null,

        direction: current.direction,
        volume: current.volume,

        status: current.status,
        freshness: current.freshness,
        source: current.source,

        retrievedAt: current.retrievedAt,
        marketTimestamp: current.marketTimestamp,

        attentionScore,
        tier,

        signals,

        reasons: explanation.reasons,
        explanation: explanation.summary,
        explanationDisclaimer:
          explanation.disclaimer,
      };
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
    if (
      tierOrder[a.tier] !==
      tierOrder[b.tier]
    ) {
      return (
        tierOrder[a.tier] -
        tierOrder[b.tier]
      );
    }

    return (
      b.attentionScore -
      a.attentionScore
    );
  });
}


/**
 * Build watchlist summary.
 */
function buildSummary(items) {
  return {
    significant: items.filter(
      (item) =>
        item.tier === 'significant'
    ).length,

    worthWatching: items.filter(
      (item) =>
        item.tier === 'worth_watching'
    ).length,

    normal: items.filter(
      (item) =>
        item.tier === 'normal'
    ).length,
  };
}


/**
 * GET /api/watchlist
 *
 * Fetches current market data and compares
 * it with the user's LAST ACKNOWLEDGED VIEW.
 *
 * IMPORTANT:
 * This function does NOT save anything.
 */
export async function getWatchlistView(userId) {
  const symbols =
    await getWatchlistSymbols(userId);

  if (symbols.length === 0) {
    return {
      generatedAt:
        new Date().toISOString(),

      items: [],

      summary: {
        significant: 0,
        worthWatching: 0,
        normal: 0,
      },
    };
  }

  const previousBySymbol =
    await getPreviousSnapshots(
      userId,
      symbols
    );

  const items =
    await buildCurrentItems(
      symbols,
      previousBySymbol
    );

  const cleanItems =
    sortItems(items);

  return {
    generatedAt:
      new Date().toISOString(),

    items: cleanItems,

    summary:
      buildSummary(cleanItems),
  };
}


/**
 * POST /api/watchlist/view
 *
 * Acknowledge the currently visible watchlist.
 *
 * This creates the baseline for the NEXT visit.
 */
export async function saveCurrentWatchlistView(userId) {
  const symbols =
    await getWatchlistSymbols(userId);

  if (symbols.length === 0) {
    return {
      saved: 0,
      savedAt: new Date().toISOString(),
    };
  }

  const currentItems =
    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          if (
            config.marketDataProvider !==
            'yahoo'
          ) {
            throw new Error(
              `Unsupported market data provider: ${config.marketDataProvider}`
            );
          }

          const current =
            await getQuote(symbol);

          if (
            current.status !== 'ok' ||
            !Number.isFinite(
              current.price
            )
          ) {
            return null;
          }

          return {
            symbol,
            price: current.price,
            volume: current.volume,
            freshness:
              current.freshness,
          };
        } catch (error) {
          console.error(
            `Unable to save snapshot for ${symbol}:`,
            error.message
          );

          return null;
        }
      })
    );

  const validItems =
    currentItems.filter(Boolean);

  if (validItems.length === 0) {
    return {
      saved: 0,
      savedAt: new Date().toISOString(),
      message:
        'No valid market data was available to save.',
    };
  }

  const client =
    await pool.connect();

  try {
    await client.query('BEGIN');

    for (const item of validItems) {
      await client.query(
        `INSERT INTO market_snapshots
        (
          user_id,
          symbol,
          price,
          volume,
          freshness,
          viewed_at
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          NOW()
        )`,
        [
          userId,
          item.symbol,
          item.price,
          item.volume,
          item.freshness,
        ]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return {
    saved: validItems.length,
    savedAt:
      new Date().toISOString(),
  };
}


/**
 * Add a dynamically discovered stock.
 */
export async function addStockToWatchlist({
  userId,
  symbol,
  name,
  exchange,
  currency,
}) {
  const normalizedSymbol =
    symbol.trim().toUpperCase();

  const normalizedName =
    typeof name === 'string' &&
    name.trim()
      ? name.trim()
      : normalizedSymbol;

  const watchlistResult =
    await query(
      `SELECT id
       FROM watchlists
       WHERE user_id = $1
         AND name = $2`,
      [
        userId,
        WATCHLIST_NAME,
      ]
    );

  const watchlistId =
    watchlistResult.rows[0]?.id;

  if (!watchlistId) {
    throw new Error(
      'Watchlist not found'
    );
  }

  let normalizedExchange = null;

  if (typeof exchange === 'string') {
    if (
      exchange
        .toLowerCase()
        .includes('bombay')
    ) {
      normalizedExchange = 'BSE';
    } else if (
      exchange
        .toLowerCase()
        .includes('nse')
    ) {
      normalizedExchange = 'NSE';
    } else {
      normalizedExchange =
        exchange.trim();
    }
  }

  await query(
    `INSERT INTO stock_metadata
    (
      symbol,
      name,
      exchange
    )
    VALUES ($1, $2, $3)
    ON CONFLICT (symbol)
    DO UPDATE SET
      name = EXCLUDED.name,
      exchange = COALESCE(
        EXCLUDED.exchange,
        stock_metadata.exchange
      )`,
    [
      normalizedSymbol,
      normalizedName,
      normalizedExchange,
    ]
  );

  const result =
    await query(
      `INSERT INTO watchlist_stocks
      (
        watchlist_id,
        symbol
      )
      VALUES ($1, $2)
      ON CONFLICT (
        watchlist_id,
        symbol
      )
      DO NOTHING
      RETURNING symbol`,
      [
        watchlistId,
        normalizedSymbol,
      ]
    );

  return {
    symbol: normalizedSymbol,
    name: normalizedName,
    exchange: normalizedExchange,
    currency: currency || null,
    added:
      result.rows.length > 0,
  };
}


/**
 * Remove a stock from the watchlist.
 */
export async function removeStockFromWatchlist(userId, symbol) {
  const normalizedSymbol =
    symbol.trim().toUpperCase();

  const watchlistResult =
    await query(
      `SELECT id
       FROM watchlists
       WHERE user_id = $1
         AND name = $2`,
      [
        userId,
        WATCHLIST_NAME,
      ]
    );

  const watchlistId =
    watchlistResult.rows[0]?.id;

  if (!watchlistId) {
    throw new Error(
      'Watchlist not found'
    );
  }

  const result =
    await query(
      `DELETE FROM watchlist_stocks
       WHERE watchlist_id = $1
         AND symbol = $2
       RETURNING symbol`,
      [
        watchlistId,
        normalizedSymbol,
      ]
    );

  return {
    symbol: normalizedSymbol,
    removed:
      result.rows.length > 0,
  };
}