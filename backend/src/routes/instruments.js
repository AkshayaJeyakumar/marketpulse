import { Router } from 'express';
import { searchInstruments } from '../services/instrumentSearchService.js';

const router = Router();

router.get('/search', async (req, res, next) => {
  try {
    const keyword = req.query.q;

    if (!keyword || typeof keyword !== 'string') {
      return res.status(400).json({
        error: 'Search keyword is required',
      });
    }

    const results = await searchInstruments(keyword);

    res.json({
      query: keyword,
      results,
    });
  } catch (err) {
    next(err);
  }
});

export default router;