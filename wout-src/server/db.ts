import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * SQLite storage. `user_state` matches the original Wout schema exactly
 * (one JSON WorkoutState blob per user + optimistic-concurrency revision).
 * `users` and `auth_sessions` replace the original hosted sign-in.
 */
export function openDatabase(file: string) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions(user_id);
    CREATE TABLE IF NOT EXISTS user_state (
      user_id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      revision INTEGER DEFAULT 1 NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  return db;
}

/** Minimal D1-style adapter so the reference `store.ts` runs unchanged on node:sqlite. */
export function d1Adapter(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const statement = db.prepare(sql);
      return {
        bind(...args: any[]) {
          return {
            async first() { return statement.get(...args) ?? null; },
            async run() { const result = statement.run(...args); return { meta: { changes: Number(result.changes) } }; },
          };
        },
      };
    },
  };
}
