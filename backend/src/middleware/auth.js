import { getUserFromToken } from '../services/authService.js';

function getBearerToken(req) {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ')
    ? header.slice('Bearer '.length).trim()
    : null;
}

export async function requireAuth(req, res, next) {
  try {
    const user = await getUserFromToken(getBearerToken(req));

    if (!user) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    req.user = user;
    req.authToken = getBearerToken(req);
    next();
  } catch (error) {
    next(error);
  }
}
