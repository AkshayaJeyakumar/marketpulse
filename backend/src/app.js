import express from 'express';
import cors from 'cors';

import healthRouter from './routes/health.js';
import watchlistRouter from './routes/watchlist.js';
import instrumentSearchRouter from './routes/instruments.js';
import marketRouter from './routes/market.js';
import authRouter from './routes/auth.js';
import recommendationsRouter from './routes/recommendations.js';


export function createApp() {

  const app = express();

  app.use(cors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
  }));

  app.use(express.json());


  app.use(
    '/api/health',
    healthRouter
  );

  app.use(
    '/api/auth',
    authRouter
  );

  app.use(
    '/api/watchlist',
    watchlistRouter
  );

  app.use(
    '/api/recommendations',
    recommendationsRouter
  );

  app.use(
    '/api/instruments',
    instrumentSearchRouter
  );

  app.use(
    '/api/market',
    marketRouter
  );


  app.use(
    (req, res) =>
      res.status(404).json({
        error: 'Not found',
      })
  );


  app.use(
    (
      err,
      req,
      res,
      next
    ) => {

      console.error(err);

      const databaseUnavailable = [
        'ETIMEDOUT',
        'ECONNREFUSED',
        'ENETUNREACH',
        '57P01',
      ].includes(err.code);

      const authSchemaMissing = [
        '42703',
        '42P01',
      ].includes(err.code);

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

    }
  );


  return app;
}