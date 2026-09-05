import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

import {
  getWatchlistView,
  saveCurrentWatchlistView,
  addStockToWatchlist,
  removeStockFromWatchlist,
} from '../services/watchlistService.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const view = await getWatchlistView(req.user.id);

    res.json(view);
  } catch (err) {
    next(err);
  }
});

router.post('/view', requireAuth, async (req, res, next) => {
  try {
    const result = await saveCurrentWatchlistView(req.user.id);

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/stocks', requireAuth, async (req, res, next) => {
  try {
    const {
      symbol,
      name,
      exchange,
      currency,
    } = req.body;

    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        error: 'Stock symbol is required',
      });
    }

    const result =
      await addStockToWatchlist({
        userId: req.user.id,
        symbol,
        name,
        exchange,
        currency,
      });

    res
      .status(result.added ? 201 : 200)
      .json(result);
  } catch (err) {
    next(err);
  }
});

router.delete('/stocks/:symbol', requireAuth, async (req, res, next) => {
  try {
    const result =
      await removeStockFromWatchlist(
        req.user.id,
        req.params.symbol
      );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;