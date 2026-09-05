import { query } from './database.js';

const symbols = [
  'TCS',
  'INFY',
  'RELIANCE',
  'TATAMOTORS',
  'HDFCBANK',
  'ITC',
  'ZOMATO',
  'ADANIENT',
];

async function seedWatchlist() {
  try {
    const userResult = await query(
      `SELECT id
       FROM users
       WHERE email = $1`,
      ['demo@marketpulse.local']
    );

    if (userResult.rows.length === 0) {
      throw new Error('Demo user not found.');
    }

    const userId = userResult.rows[0].id;

    const watchlistResult = await query(
      `SELECT id
       FROM watchlists
       WHERE user_id = $1
         AND name = $2`,
      [userId, 'My Watchlist']
    );

    if (watchlistResult.rows.length === 0) {
      throw new Error('Demo watchlist not found.');
    }

    const watchlistId = watchlistResult.rows[0].id;

    for (const symbol of symbols) {
      await query(
        `INSERT INTO watchlist_stocks (watchlist_id, symbol)
         VALUES ($1, $2)
         ON CONFLICT (watchlist_id, symbol)
         DO NOTHING`,
        [watchlistId, symbol]
      );
    }

    console.log(`Successfully added ${symbols.length} stocks to My Watchlist.`);
  } catch (error) {
    console.error('Watchlist seed failed:', error.message);
  }
}

seedWatchlist();