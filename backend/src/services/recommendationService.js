import { query } from '../db/database.js';

const WATCHLIST_NAME = 'My Watchlist';
const DEFAULT_LIMIT = 5;

export async function getWatchlistRecommendations(userId, limit = DEFAULT_LIMIT) {
  const result = await query(
    `WITH watched AS (
       SELECT DISTINCT ws.symbol, sm.sector
       FROM watchlists w
       JOIN watchlist_stocks ws ON ws.watchlist_id = w.id
       JOIN stock_metadata sm ON sm.symbol = ws.symbol
       WHERE w.user_id = $1
         AND w.name = $2
     ),
     sector_counts AS (
       SELECT sector, COUNT(*)::int AS watched_count
       FROM watched
       WHERE sector IS NOT NULL AND sector <> ''
       GROUP BY sector
     ),
     dismissed AS (
       SELECT symbol
       FROM user_stock_interactions
       WHERE user_id = $1
         AND interaction_type = 'not_interested'
     )
     SELECT
       candidate.symbol,
       candidate.name,
       candidate.exchange,
       candidate.sector,
       counts.watched_count,
       (counts.watched_count * 50)::int AS score
     FROM stock_metadata candidate
     JOIN sector_counts counts ON counts.sector = candidate.sector
     LEFT JOIN watched existing ON existing.symbol = candidate.symbol
     LEFT JOIN dismissed ON dismissed.symbol = candidate.symbol
     WHERE existing.symbol IS NULL
       AND dismissed.symbol IS NULL
       AND candidate.name IS NOT NULL
       AND candidate.name <> ''
       AND candidate.sector IS NOT NULL
       AND candidate.sector <> ''
     ORDER BY score DESC, candidate.symbol ASC
     LIMIT $3`,
    [userId, WATCHLIST_NAME, limit]
  );

  return result.rows.map((row) => ({
    symbol: row.symbol,
    name: row.name,
    exchange: row.exchange,
    sector: row.sector,
    score: row.score,
    matchType: 'sector',
    reason: row.watched_count > 1
      ? `You track several ${row.sector} companies.`
      : `Related to a stock in your watchlist.`,
  }));
}

export async function markRecommendationNotInterested(userId, symbol) {
  await query(
    `INSERT INTO user_stock_interactions
      (user_id, symbol, interaction_type)
     VALUES ($1, $2, 'not_interested')
     ON CONFLICT (user_id, symbol, interaction_type)
     DO NOTHING`,
    [userId, symbol.trim().toUpperCase()]
  );
}
