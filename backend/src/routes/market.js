import { Router } from 'express';

import {
  getHistoricalPrices,
} from '../services/marketDataService.js';


const router = Router();


/*
 * GET historical price data
 *
 * Examples:
 *
 * /api/market/history/TCS?range=1d
 * /api/market/history/TCS?range=1w
 * /api/market/history/TCS?range=1m
 */
router.get(
  '/history/:symbol',
  async (req, res, next) => {

    try {

      const symbol =
        req.params.symbol;


      const requestedRange =
        String(
          req.query.range || '1d'
        ).toLowerCase();


      /*
       * Only allow the ranges supported
       * by the Market Data Service.
       */
      const allowedRanges = [
        '1d',
        '1w',
        '1m',
      ];


      const range =
        allowedRanges.includes(
          requestedRange
        )
          ? requestedRange
          : '1d';


      const result =
        await getHistoricalPrices(
          symbol,
          range
        );


      res.json(result);

    } catch (error) {

      next(error);

    }

  }
);


/*
 * IMPORTANT:
 * app.js imports this file as:
 *
 * import marketRouter from './routes/market.js';
 *
 * Therefore this file must provide
 * a default export.
 */
export default router;