import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { DatabaseSync } from 'node:sqlite';

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number, options: object) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const SESSION_DAYS = 60;
const DAY = 86_400_000;

export type User = { id: string; name: string; email: string };

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64, SCRYPT);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [kind, salt, key] = stored.split('$');
  if (kind !== 'scrypt' || !salt || !key) return false;
  const expected = Buffer.from(key, 'base64');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, SCRYPT);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const validEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function createAccounts(db: DatabaseSync) {
  const byEmail = db.prepare('SELECT id, name, email, password_hash FROM users WHERE email = ?');
  const insertUser = db.prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)');
  const insertSession = db.prepare('INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)');
  const sessionUser = db.prepare(`SELECT u.id, u.name, u.email, s.expires_at FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`);
  const deleteSession = db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?');
  const purge = db.prepare('DELETE FROM auth_sessions WHERE expires_at < ?');
  const touch = db.prepare('UPDATE auth_sessions SET expires_at = ? WHERE token_hash = ?');

  return {
    async signUp(name: string, email: string, password: string): Promise<User> {
      const id = randomUUID();
      insertUser.run(id, email, name, await hashPassword(password), Date.now());
      return { id, name, email };
    },
    findByEmail(email: string) {
      return byEmail.get(email) as (User & { password_hash: string }) | undefined;
    },
    startSession(userId: string) {
      const token = randomBytes(32).toString('base64url');
      const now = Date.now();
      purge.run(now);
      insertSession.run(tokenHash(token), userId, now, now + SESSION_DAYS * DAY);
      return token;
    },
    userForToken(token: string | undefined): User | null {
      if (!token) return null;
      const hash = tokenHash(token);
      const row = sessionUser.get(hash) as (User & { expires_at: number }) | undefined;
      if (!row || row.expires_at < Date.now()) return null;
      // Sliding expiry: refresh at most once a day.
      const renewed = Date.now() + SESSION_DAYS * DAY;
      if (renewed - row.expires_at > DAY) touch.run(renewed, hash);
      return { id: row.id, name: row.name, email: row.email };
    },
    endSession(token: string | undefined) {
      if (token) deleteSession.run(tokenHash(token));
    },
  };
}

/** Small in-memory limiter for sign-in attempts (per IP + email). */
export function createLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string) => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter(at => now - at < windowMs);
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some(at => now - at < windowMs)) hits.delete(k);
    return recent.length <= max;
  };
}
