import 'dotenv/config';

export const config = {
  port: process.env.PORT || 4000,

  nodeEnv:
    process.env.NODE_ENV || 'development',

  databaseUrl:
    process.env.DATABASE_URL || null,

  marketDataProvider:
    process.env.MARKET_DATA_PROVIDER || 'demo',

  upstox: {
    apiKey:
      process.env.UPSTOX_API_KEY || null,

    apiSecret:
      process.env.UPSTOX_API_SECRET || null,
  },
};