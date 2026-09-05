import { query } from './src/db/database.js';

const sql = `
  SELECT
    symbol,
    price,
    volume,
    viewed_at
  FROM market_snapshots
  WHERE user_id = (
    SELECT id
    FROM users
    WHERE email = 'demo@marketpulse.local'
  )
  ORDER BY viewed_at DESC
  LIMIT 20
`;

const result = await query(sql);

console.table(result.rows);

process.exit(0);