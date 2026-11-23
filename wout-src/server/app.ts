import { Hono, type Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { DatabaseSync } from 'node:sqlite';
import { d1Adapter } from './db.ts';
import { createAccounts, createLimiter, normalizeEmail, validEmail, SESSION_DAYS, verifyPassword, type User } from './auth.ts';
import { loadState, saveState } from './store.ts';
import { validateState } from '../shared/workout.ts';

const COOKIE = 'wout_session';
const MAX_BODY = 4_000_000;

type Env = { Variables: { user: User | null } };

export function createApp(db: DatabaseSync, options: { secureCookies?: boolean } = {}) {
  const app = new Hono<Env>();
  const accounts = createAccounts(db);
  const store = d1Adapter(db);
  const limitAuth = createLimiter(10, 15 * 60_000);

  const json = (c: Context, body: unknown, status = 200) => {
    c.header('Cache-Control', 'private, no-store');
    return c.json(body as object, status as 200);
  };
  const setSession = (c: Context, token: string) => setCookie(c, COOKIE, token, {
    httpOnly: true, sameSite: 'Lax', secure: !!options.secureCookies, path: '/', maxAge: SESSION_DAYS * 86_400,
  });
  // Mutating requests must come from this site (same check as the original state route).
  const sameOrigin = (c: Context) => {
    const origin = c.req.header('origin');
    if (!origin) return false;
    try { return new URL(origin).host === new URL(c.req.url).host; } catch { return false; }
  };
  const readJson = async (c: Context): Promise<any> => {
    if (!c.req.header('content-type')?.includes('application/json')) return { error: ['Expected JSON', 415] };
    const text = await c.req.text();
    if (text.length > MAX_BODY) return { error: ['Account storage limit reached. Export your history.', 413] };
    try { return { body: JSON.parse(text) }; } catch { return { error: ['Invalid JSON', 400] }; }
  };
  const publicUser = (u: User) => ({ id: u.id, name: u.name, email: u.email });

  app.use('/api/*', async (c, next) => {
    c.set('user', accounts.userForToken(getCookie(c, COOKIE)));
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && !sameOrigin(c)) return json(c, { error: 'Invalid request origin' }, 403);
    await next();
  });

  app.get('/api/health', c => json(c, { ok: true }));

  app.post('/api/auth/signup', async c => {
    const { body, error } = await readJson(c);
    if (error) return json(c, { error: error[0] }, error[1]);
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : '';
    const email = typeof body?.email === 'string' ? normalizeEmail(body.email) : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!name) return json(c, { error: 'Enter your name.' }, 400);
    if (!validEmail(email)) return json(c, { error: 'Enter a valid email.' }, 400);
    if (password.length < 8 || password.length > 200) return json(c, { error: 'Use a password of at least 8 characters.' }, 400);
    if (!limitAuth('signup:' + (c.req.header('x-forwarded-for') ?? 'local'))) return json(c, { error: 'Too many attempts. Try again later.' }, 429);
    if (accounts.findByEmail(email)) return json(c, { error: 'An account with this email already exists.' }, 409);
    const user = await accounts.signUp(name, email, password);
    setSession(c, accounts.startSession(user.id));
    return json(c, { user: publicUser(user) }, 201);
  });

  app.post('/api/auth/login', async c => {
    const { body, error } = await readJson(c);
    if (error) return json(c, { error: error[0] }, error[1]);
    const email = typeof body?.email === 'string' ? normalizeEmail(body.email) : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!limitAuth('login:' + email + ':' + (c.req.header('x-forwarded-for') ?? 'local'))) return json(c, { error: 'Too many attempts. Try again in a few minutes.' }, 429);
    const row = accounts.findByEmail(email);
    if (!row || !(await verifyPassword(password, row.password_hash))) return json(c, { error: 'Email or password is incorrect.' }, 401);
    setSession(c, accounts.startSession(row.id));
    return json(c, { user: publicUser(row) });
  });

  app.post('/api/auth/logout', c => {
    accounts.endSession(getCookie(c, COOKIE));
    deleteCookie(c, COOKIE, { path: '/' });
    return json(c, { ok: true });
  });

  app.get('/api/auth/me', c => {
    const user = c.get('user');
    return user ? json(c, { user: publicUser(user) }) : json(c, { error: 'Not signed in' }, 401);
  });

  // ---- Workout state: one JSON blob per user, optimistic concurrency by revision ----
  app.get('/api/state', async c => {
    const user = c.get('user');
    if (!user) return json(c, { error: 'Sign in to sync your workouts.' }, 401);
    try {
      return json(c, { ...(await loadState(store, user.id)), user: publicUser(user) });
    } catch {
      return json(c, { error: 'Could not load workouts. Please retry.' }, 503);
    }
  });

  app.put('/api/state', async c => {
    const user = c.get('user');
    if (!user) return json(c, { error: 'Sign in to save.' }, 401);
    const { body, error } = await readJson(c);
    if (error) return json(c, { error: error[0] }, error[1]);
    const { state, revision, expectedUserId } = body ?? {};
    if (expectedUserId !== user.id) return json(c, { error: 'Your account changed. Reload before saving.' }, 403);
    if (!validateState(state) || !Number.isInteger(revision) || revision < 0) return json(c, { error: 'Invalid workout data' }, 400);
    try {
      const result = await saveState(store, user.id, state, revision, expectedUserId);
      return json(c, result, result.conflict ? 409 : 200);
    } catch {
      return json(c, { error: 'Could not save. Your edits remain on this device.' }, 503);
    }
  });

  app.all('/api/*', c => json(c, { error: 'Not found' }, 404));
  return app;
}
