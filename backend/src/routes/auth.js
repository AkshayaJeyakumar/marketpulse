import { Router } from 'express';

import {
  deleteSession,
  getUserFromToken,
  loginUser,
  registerUser,
} from '../services/authService.js';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const { displayName, email, password, confirmPassword } = req.body || {};

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    res.status(201).json(
      await registerUser({ displayName, email, password })
    );
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    res.json(await loginUser({ email, password }));
  } catch (error) {
    next(error);
  }
});

router.get('/me', async (req, res, next) => {
  try {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : null;
    const user = await getUserFromToken(token);

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : null;
    await deleteSession(token);
    res.json({ loggedOut: true });
  } catch (error) {
    next(error);
  }
});

export default router;
