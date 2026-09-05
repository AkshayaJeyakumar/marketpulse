import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL error:', error);
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function checkDatabaseConnection() {
  const result = await pool.query('SELECT NOW()');
  return result.rows[0];
}

export default pool;