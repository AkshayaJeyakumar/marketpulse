import {
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

import { pool, query } from '../db/database.js';

const scryptAsync = promisify(scrypt);
const SESSION_DAYS = 30;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name || '',
  };
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  const [, salt, expectedHex] = String(storedHash || '').split(':');

  if (!salt || !expectedHex) {
    return false;
  }

  const actual = await scryptAsync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');

  return expected.length === actual.length &&
    timingSafeEqual(expected, actual);
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function createSession(user) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  );

  await query(
    `INSERT INTO auth_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, hashToken(token), expiresAt]
  );

  return { token, expiresAt };
}

export async function registerUser({ displayName, email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const trimmedName = String(displayName || '').trim();

  if (
    !trimmedName ||
    !normalizedEmail ||
    typeof password !== 'string' ||
    !password
  ) {
    const error = new Error('Display name, email, and password are required');
    error.statusCode = 400;
    throw error;
  }

  if (!normalizedEmail.includes('@')) {
    const error = new Error('Enter a valid email address');
    error.statusCode = 400;
    throw error;
  }

  if (password.length < 8) {
    const error = new Error('Password must be at least 8 characters');
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await hashPassword(password);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `INSERT INTO users (email, display_name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name`,
      [normalizedEmail, trimmedName, passwordHash]
    );

    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO watchlists (user_id, name)
       VALUES ($1, 'My Watchlist')`,
      [user.id]
    );

    await client.query('COMMIT');

    const session = await createSession(user);
    return { user: publicUser(user), ...session };
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      const duplicate = new Error('An account with that email already exists');
      duplicate.statusCode = 409;
      throw duplicate;
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || typeof password !== 'string' || !password) {
    const error = new Error('Email and password are required');
    error.statusCode = 400;
    throw error;
  }

  const result = await query(
    `SELECT id, email, display_name, password_hash
     FROM users
     WHERE email = $1`,
    [normalizedEmail]
  );

  const user = result.rows[0];
  const valid = user && await verifyPassword(password, user.password_hash);

  if (!valid) {
    const error = new Error('Incorrect email or password');
    error.statusCode = 401;
    throw error;
  }

  const session = await createSession(user);
  return { user: publicUser(user), ...session };
}

export async function getUserFromToken(token) {
  if (!token) {
    return null;
  }

  const result = await query(
    `SELECT u.id, u.email, u.display_name
     FROM auth_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND s.expires_at > NOW()`,
    [hashToken(token)]
  );

  return result.rows[0] ? publicUser(result.rows[0]) : null;
}

export async function deleteSession(token) {
  if (token) {
    await query(
      'DELETE FROM auth_sessions WHERE token_hash = $1',
      [hashToken(token)]
    );
  }
}
