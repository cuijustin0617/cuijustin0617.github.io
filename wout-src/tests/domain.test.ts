import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalog, exerciseById } from '../shared/catalog.ts';
import { oneRepMax, bodyweightStandards, percentile, strengthLeaderboard } from '../shared/strength.ts';
import { emptyState, validateState, addExercise, finishSession, type WorkoutState } from '../shared/workout.ts';
import empty from '../data/empty-wout-workouts.json';

test('catalog ids are unique and include CMU chest press', () => {
  assert.equal(new Set(catalog.map(e => e.id)).size, catalog.length);
  assert.equal(exerciseById.get('chest-press')?.name, 'Chest Press Machine (CMU)');
});

test('estimated 1RM follows Brzycki / blend / Epley', () => {
  assert.equal(oneRepMax(200, 1), 200);
  assert.ok(Math.abs(oneRepMax(185, 5)! - 185 * 36 / 32) < 1e-9);
  assert.ok(Math.abs(oneRepMax(115, 10)! - 153.333333) < 1e-5);
  const b = 100 * 36 / 28, e = 100 * (1 + 9 / 30);
  assert.ok(Math.abs(oneRepMax(100, 9)! - (b + (e - b) / 2)) < 1e-9);
  assert.equal(oneRepMax(100, 31), null);
});

test('percentile interpolates between anchors', () => {
  const s = [127, 169, 220, 277, 339];
  assert.equal(percentile(100, s).label, '<5%');
  assert.equal(percentile(400, s).label, '>95%');
  assert.ok(Math.abs(percentile(220, s).value - 50) < 1e-9);
  assert.equal(percentile(208, s).level, 'Novice');
});

test('CMU 115×10 matches Bench 175×1 at the same bodyweight', () => {
  for (const bw of [150, 180, 215]) {
    const bench = bodyweightStandards(exerciseById.get('bench-press')!, 'male', bw)!;
    const cmu = bodyweightStandards(exerciseById.get('chest-press')!, 'male', bw)!;
    const a = percentile(oneRepMax(175, 1)!, bench.values).value;
    const b = percentile(oneRepMax(115, 10)!, cmu.values).value;
    assert.ok(Math.abs(a - b) < 1e-6, `bw ${bw}: ${a} vs ${b}`);
  }
});

test('added-weight lifts subtract training-day bodyweight', () => {
  const state: WorkoutState = { ...emptyState(), bodyweights: [{ id: 'b', weight: 180, recordedAt: 1_700_000_000_000 }], profile: { sex: 'male', bodyweight: 180 },
    history: [{ id: 's', name: 'Pull', startedAt: 1_700_000_100_000, finishedAt: 1_700_000_200_000, exercises: [{ id: 'l', exerciseId: 'neutral-grip-pull-ups', sets: [{ id: 'x', weight: 45, reps: 6, done: true }] }] }] };
  const row = strengthLeaderboard(state, catalog, 1_800_000_000_000).ranked[0];
  assert.ok(Math.abs(row.estimatedMax - (225 * 36 / 31 - 180)) < 1e-9);
});

test('empty export validates; finishing keeps only completed sets', () => {
  assert.ok(validateState(empty));
  let s = addExercise(emptyState(), 'bench-press');
  assert.throws(() => finishSession(s));
  const ex = s.active!.exercises[0];
  s = { ...s, active: { ...s.active!, exercises: [{ ...ex, sets: [{ ...ex.sets[0], weight: 135, reps: 5, done: true, completedAt: Date.now() }, ...ex.sets.slice(1)] }] } };
  const done = finishSession(s);
  assert.equal(done.active, null);
  assert.equal(done.history[0].exercises[0].sets.length, 1);
  assert.ok(validateState(done));
});

import { bigGroupOf, rankBigGroups } from '../shared/big-groups.ts';

test('big groups: classification follows the five-group rules', () => {
  const g = (id: string) => bigGroupOf(exerciseById.get(id)!);
  assert.equal(g('bench-press'), 'chest'); assert.equal(g('dips'), 'chest'); assert.equal(g('machine-chest-fly'), 'chest'); assert.equal(g('chest-press'), 'chest');
  assert.equal(g('pull-ups'), 'vertical-back'); assert.equal(g('lat-pulldown'), 'vertical-back'); assert.equal(g('neutral-grip-pull-ups'), 'vertical-back');
  assert.equal(g('machine-row'), 'horizontal-back');
  assert.equal(bigGroupOf({ name: 'Hammer Strength Iso-Lateral Row' }), 'horizontal-back');
  assert.equal(g('romanian-deadlift'), 'hamstrings'); assert.equal(g('seated-leg-curl'), 'hamstrings'); assert.equal(g('dumbbell-romanian-deadlift'), 'hamstrings');
  assert.equal(g('squat'), 'quads'); assert.equal(g('dumbbell-bulgarian-split-squat'), 'quads');
  assert.equal(bigGroupOf({ name: 'Upright Row' }), null); assert.equal(bigGroupOf({ name: 'Reverse Fly' }), null);
  assert.equal(g('dumbbell-shoulder-press'), null); assert.equal(g('dumbbell-curl'), null);
});

test('big groups: ranked by longest since trained; future sets and current workout handled', () => {
  const day = 86_400_000, now = Date.UTC(2026, 10, 23, 18);
  const session = (id: string, daysAgo: number, exerciseIds: string[]) => ({ id, name: id, startedAt: now - daysAgo * day, finishedAt: now - daysAgo * day,
    exercises: exerciseIds.map((e, i) => ({ id: id + i, exerciseId: e, sets: [{ id: id + i + 's', weight: 100, reps: 5, done: true }] })) });
  const state: WorkoutState = { ...emptyState(), history: [
    session('a', 1, ['squat', 'bench-press']),   // squat does NOT count for hamstrings
    session('b', 4, ['lat-pulldown']),
    session('c', 6, ['machine-row']),
    session('d', 9, ['romanian-deadlift']),
    session('future', -0.1, ['romanian-deadlift']), // later than now: ignored
  ] };
  assert.deepEqual(rankBigGroups(state, catalog, now).map(r => r.id), ['hamstrings', 'horizontal-back', 'vertical-back', 'chest', 'quads']);
  const withActive = { ...state, active: { id: 'act', name: 'x', startedAt: now, exercises: [{ id: 'q', exerciseId: 'seated-leg-curl', sets: [] }] } };
  const ranked = rankBigGroups(withActive, catalog, now);
  assert.equal(ranked.at(-1)!.id, 'hamstrings'); assert.ok(ranked.at(-1)!.inWorkout);
});

import { sessionTitle, shortExerciseName } from '../shared/session-title.ts';

test('session titles: concise exercise summary unless a custom name is set', () => {
  const s = (name: string, ex: [string, number][]) => ({ name, exercises: ex.map(([id, n], i) => ({ id: 'e' + i, exerciseId: id, sets: Array.from({ length: n }, (_, j) => ({ id: `${i}-${j}`, weight: 0, reps: 5, done: true })) })) });
  assert.equal(sessionTitle(s('Freestyle workout', [['bench-press', 3], ['squat', 4], ['incline-bench-press', 3]]), exerciseById), '3×Bench · 4×Squat · 3×Inc Bench');
  assert.equal(sessionTitle(s('Freestyle workout', [['bench-press', 2], ['dips', 3], ['bench-press', 1]]), exerciseById), '3×Bench · 3×Dips');
  assert.equal(sessionTitle(s('Push Day', [['bench-press', 3]]), exerciseById), 'Push Day');
  assert.equal(sessionTitle(s('Freestyle workout', []), exerciseById), 'Empty workout');
  assert.equal(shortExerciseName({ id: 'x', name: 'Hammer Strength Iso-Lateral Row' }), 'Iso Row');
  assert.equal(shortExerciseName({ id: 'x', name: 'Incline Dumbbell Curl' }), 'Inc DB Curl');
});
