import { query } from './database.js';

const stocks = [
  {
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    exchange: 'NSE',
    sector: 'Information Technology',
  },
  {
    symbol: 'INFY',
    name: 'Infosys',
    exchange: 'NSE',
    sector: 'Information Technology',
  },
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries',
    exchange: 'NSE',
    sector: 'Energy',
  },
  {
    symbol: 'TATAMOTORS',
    name: 'Tata Motors',
    exchange: 'NSE',
    sector: 'Automobiles',
  },
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank',
    exchange: 'NSE',
    sector: 'Banking',
  },
  {
    symbol: 'ITC',
    name: 'ITC Limited',
    exchange: 'NSE',
    sector: 'FMCG',
  },
  {
    symbol: 'ZOMATO',
    name: 'Eternal (Zomato)',
    exchange: 'NSE',
    sector: 'Internet & Consumer Services',
  },
  {
    symbol: 'ADANIENT',
    name: 'Adani Enterprises',
    exchange: 'NSE',
    sector: 'Diversified',
  },
];

async function seedStocks() {
  try {
    for (const stock of stocks) {
      await query(
        `INSERT INTO stock_metadata (symbol, name, exchange, sector)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (symbol)
         DO UPDATE SET
           name = EXCLUDED.name,
           exchange = EXCLUDED.exchange,
           sector = EXCLUDED.sector,
           updated_at = NOW()`,
        [stock.symbol, stock.name, stock.exchange, stock.sector]
      );
    }

    console.log(`Successfully seeded ${stocks.length} stocks.`);
  } catch (error) {
    console.error('Stock seed failed:', error.message);
  }
}

seedStocks();