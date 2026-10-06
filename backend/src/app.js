import express from 'express';
import cors from 'cors';

import healthRouter from './routes/health.js';
import watchlistRouter from './routes/watchlist.js';
import instrumentSearchRouter from './routes/instruments.js';
import marketRouter from './routes/market.js';
import authRouter from './routes/auth.js';
import recommendationsRouter from './routes/recommendations.js';

import { runBacktest } from './services/backtestingService.js';
import { getHistoricalPrices, getBenchmarkHistory } from './services/marketDataService.js';

export function createApp() {
  const app = express();

  const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  app.use(
    cors({
      origin: allowedOrigins,
    })
  );

  app.use(express.json());

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/watchlist', watchlistRouter);
  app.use('/api/recommendations', recommendationsRouter);
  app.use('/api/instruments', instrumentSearchRouter);
  app.use('/api/market', marketRouter);

  /**
   * POST /api/backtest/:symbol
   *
   * Runs historical backtest strategy for a specific stock against NIFTY 50 benchmark.
   */
  app.post('/api/backtest/:symbol', async (req, res, next) => {
    try {
      const symbol = req.params.symbol;
      const stockData = await getHistoricalPrices(symbol, '3mo');
      const benchmarkData = await getBenchmarkHistory('3mo');

      if (
        stockData?.status !== 'ok' ||
        benchmarkData?.status !== 'ok' ||
        !Array.isArray(stockData?.points) ||
        !Array.isArray(benchmarkData?.points)
      ) {
        return res.status(400).json({
          error: 'Insufficient historical market data available for backtesting.',
        });
      }

      const backtestResult = runBacktest(stockData.points, benchmarkData.points);
      res.json(backtestResult);
    } catch (error) {
      next(error);
    }
  });

  app.use((req, res) =>
    res.status(404).json({
      error: 'Not found',
    })
  );

  app.use((err, req, res, next) => {
    console.error(err);

    const databaseUnavailable = [
      'ETIMEDOUT',
      'ECONNREFUSED',
      'ENETUNREACH',
      '57P01',
    ].includes(err.code);

    const authSchemaMissing = ['42703', '42P01'].includes(err.code);

    res.status(
      err.statusCode ||
        (databaseUnavailable || authSchemaMissing ? 503 : 500)
    ).json({
      error: databaseUnavailable
        ? 'Database unavailable. Check the Supabase connection.'
        : authSchemaMissing
          ? 'Authentication database schema is missing. Run 002_auth.sql in Supabase.'
          : err.statusCode
            ? err.message
            : 'Internal server error',
    });
  });

  return app;
}