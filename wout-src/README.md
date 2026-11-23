# Wout

A quiet, phone-first strength log. Expressive tonal UI (compact density) with a Glass floating bubble navigation, synced to your own server.

- **Workout** — active session with elapsed time, sets and volume; set rows with previous performance, ±5 lb steppers, reps and complete toggles; automatic rest timer; balance suggestions (muscle group first, 1–3 exercise choices) and "likely next" chips; repeat a past workout.
- **Progress** — Weight (log bodyweight, trend, entries) · Strength (community percentiles with the 5-anchor tier track, expandable source/clamping/estimate notes) · Muscles (front/back body map of weekly/monthly credited sets, due muscle) · Goals (up to 3 dated targets, measured history, targets and a dashed projection).
- **History** — sessions by month, expand, repeat, edit (name, date, sets, exercises), delete with undo.
- **Exercises** — 291-exercise catalog search, favorites/recent/frequent, availability, standards and 1RM trend per exercise.
- **Profile** — account, sync status, reference sex/bodyweight, rest-timer default, export/import `wout-workouts.json`, sign out.

## Run it

Requires Node.js ≥ 22.13 (uses the built-in `node:sqlite`).

```bash
npm install
npm run dev          # API on :8787 + Vite on :5173 → open http://localhost:5173
```

Production (one process serves the API and the built app):

```bash
npm run build
PORT=8787 WOUT_DB=./var/wout.db SECURE_COOKIES=1 npm start
```

Set `SECURE_COOKIES=1` whenever the app is served over HTTPS (it should be in production). Put it behind any HTTPS reverse proxy (Caddy, nginx, Fly.io, Render, a VPS). Back up the SQLite file in `WOUT_DB`.

```bash
npm test             # domain formulas (1RM, percentiles, CMU equivalence) + API (auth, sync, conflicts, origin checks)
npm run typecheck
```

## Architecture

```
shared/   Domain logic ported verbatim from the Wout transfer package (validation, 1RM, strength
          standards, muscle credit, suggestions, goals/projection). Used by client and server.
server/   Hono API on Node. SQLite via node:sqlite.
          users + auth_sessions (scrypt passwords, HTTP-only session cookie, sliding 60-day expiry)
          user_state(user_id, data, revision, updated_at) — identical to the original schema.
src/      React + Vite client. Local-first store: every change is written to localStorage
          (`set-pending-<userId>`) and synced with optimistic concurrency.
data/     Exercise catalog, standards, CMU calibration, provenance, JSON schema, MuscleMap paths.
```

### API

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/signup` | `{name, email, password}` (≥ 8 chars) |
| POST | `/api/auth/login` | `{email, password}`; rate-limited |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/me` | |
| GET | `/api/state` | `{state, revision, user}`; empty state for new accounts |
| PUT | `/api/state` | `{state, revision, expectedUserId}` → `{revision, conflict}`; 409 on stale revision |

Mutating requests must carry a same-host `Origin`. State is validated with the reference `validateState` and capped at 4 MB.

### Sync & conflicts

Edits apply instantly and are saved after ~0.6 s. Offline edits stay on the device and retry when the network or tab focus returns. If another device saved first (409), a banner offers **Use cloud** or **Keep this device**. The rest timer is device-local and is not part of the export.

## Migrating your data

Sign in, open **Profile → Import workouts**, and choose the `wout-workouts.json` you exported from the original app. IDs, ordering and timestamps are preserved; all derived values are recomputed.

## Credits

Strength standards: Strength Level community data (see `data/provenance/`). CMU Chest Press is a bench-equivalent estimate, not population data. Body diagrams: [MuscleMap](https://github.com/melihcolpan/MuscleMap) by Melih Colpan, MIT (`data/MUSCLEMAP-LICENSE.md`).
