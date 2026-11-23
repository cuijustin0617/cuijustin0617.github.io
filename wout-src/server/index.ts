import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase } from './db.ts';
import { createApp } from './app.ts';

const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 8787);
const dbFile = process.env.WOUT_DB ?? resolve('var/wout.db');

const db = openDatabase(dbFile);
const app = createApp(db, { secureCookies: process.env.SECURE_COOKIES === '1' });

// In production the API also serves the built frontend (single deployable process).
const dist = resolve('dist');
if (production && existsSync(dist)) {
  app.use('/assets/*', serveStatic({ root: './dist', onFound: (_p, c) => { c.header('Cache-Control', 'public, max-age=31536000, immutable'); } }));
  app.use('/*', serveStatic({ root: './dist' }));
  const index = readFileSync(resolve(dist, 'index.html'), 'utf8');
  app.get('*', c => c.html(index));
}

serve({ fetch: app.fetch, port }, info => {
  console.log(`Wout API listening on http://localhost:${info.port} (db: ${dbFile})`);
});
