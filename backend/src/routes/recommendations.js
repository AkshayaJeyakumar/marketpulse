import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import {
  getWatchlistRecommendations,
  markRecommendationNotInterested,
} from '../services/recommendationService.js';

const router = Router();

router.get('/watchlist', requireAuth, async (req, res, next) => {
  try {
    const items = await getWatchlistRecommendations(req.user.id);
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.post('/watchlist/:symbol/not-interested', requireAuth, async (req, res, next) => {
  try {
    await markRecommendationNotInterested(req.user.id, req.params.symbol);
    res.json({ saved: true });
  } catch (error) {
    next(error);
  }
});

export default router;
