import { query } from './database.js';

async function seedDemo() {
  try {
    // Create demo user
    const userResult = await query(
      `INSERT INTO users (email, display_name)
       VALUES ($1, $2)
       ON CONFLICT (email)
       DO UPDATE SET display_name = EXCLUDED.display_name
       RETURNING id, email, display_name`,
      ['demo@marketpulse.local', 'MarketPulse Demo User']
    );

    const user = userResult.rows[0];

    // Create demo watchlist
    const watchlistResult = await query(
      `INSERT INTO watchlists (user_id, name)
       VALUES ($1, $2)
       RETURNING id, user_id, name`,
      [user.id, 'My Watchlist']
    );

    console.log('Demo user created:', user);
    console.log('Demo watchlist created:', watchlistResult.rows[0]);
  } catch (error) {
    console.error('Seed failed:', error.message);
  }
}

seedDemo();