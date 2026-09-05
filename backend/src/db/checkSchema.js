import { query } from './database.js';

async function checkSchema() {
  try {
    const result = await query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'stock_metadata' ORDER BY ordinal_position"
    );

    console.table(result.rows);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkSchema();