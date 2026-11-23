import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.ts';
import { createApp } from '../server/app.ts';
import { emptyState } from '../shared/workout.ts';

const app = createApp(openDatabase(':memory:'));
const base = 'http://wout.test';
let cookie = '';
const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
  const res = await app.request(base + path, { method, headers: { origin: base, cookie, ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const set = res.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
  return { status: res.status, body: await res.json() as any };
};

test('auth, state save, conflict, and origin checks', async () => {
  assert.equal((await call('GET', '/api/state')).status, 401);
  assert.equal((await call('POST', '/api/auth/signup', { name: 'A', email: 'bad', password: 'longenough' })).status, 400);
  const signup = await call('POST', '/api/auth/signup', { name: 'Alex', email: 'Alex@Example.com', password: 'longenough' });
  assert.equal(signup.status, 201);
  const userId = signup.body.user.id;
  assert.equal((await call('POST', '/api/auth/signup', { name: 'Alex', email: 'alex@example.com', password: 'longenough' })).status, 409);

  const loaded = await call('GET', '/api/state');
  assert.equal(loaded.body.revision, 0);
  assert.deepEqual(loaded.body.state, emptyState());

  const state = { ...emptyState(), profile: { sex: 'female', bodyweight: 140 } };
  const first = await call('PUT', '/api/state', { state, revision: 0, expectedUserId: userId });
  assert.deepEqual(first.body, { revision: 1, conflict: false });
  const stale = await call('PUT', '/api/state', { state, revision: 0, expectedUserId: userId });
  assert.equal(stale.status, 409);
  assert.equal((await call('PUT', '/api/state', { state: { ...state, history: 'x' }, revision: 1, expectedUserId: userId })).status, 400);
  assert.equal((await call('PUT', '/api/state', { state, revision: 1, expectedUserId: 'someone-else' })).status, 403);
  assert.equal((await call('PUT', '/api/state', { state, revision: 1, expectedUserId: userId }, { origin: 'http://evil.test' })).status, 403);
  assert.equal((await call('GET', '/api/state')).body.state.profile.sex, 'female');

  await call('POST', '/api/auth/logout', {});
  cookie = '';
  assert.equal((await call('POST', '/api/auth/login', { email: 'alex@example.com', password: 'wrong-pass' })).status, 401);
  const login = await call('POST', '/api/auth/login', { email: 'ALEX@example.com', password: 'longenough' });
  assert.equal(login.status, 200);
  assert.equal((await call('GET', '/api/state')).body.revision, 1);
});
