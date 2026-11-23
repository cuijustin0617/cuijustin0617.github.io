import type { Exercise, Session } from './workout.ts';

/** Names that mean "no custom name": the title is generated from the exercises instead. */
export const DEFAULT_SESSION_NAME = 'Freestyle workout';
export const isAutoName = (name: string | undefined) => !name || !name.trim() || name.trim().toLowerCase() === DEFAULT_SESSION_NAME.toLowerCase();

// Hand-tuned short names for common lifts (by catalog ID).
const SHORT: Record<string, string> = {
  'bench-press': 'Bench', 'incline-bench-press': 'Inc Bench', 'decline-bench-press': 'Dec Bench',
  'dumbbell-bench-press': 'DB Bench', 'incline-dumbbell-bench-press': 'Inc DB Bench', 'close-grip-bench-press': 'CG Bench',
  'chest-press': 'Chest Press', 'machine-chest-fly': 'Fly', 'dumbbell-fly': 'DB Fly', 'cable-fly': 'Cable Fly', 'dips': 'Dips',
  'pull-ups': 'Pull-up', 'neutral-grip-pull-ups': 'NG Pull-up', 'chin-ups': 'Chin-up', 'lat-pulldown': 'Pulldown',
  'machine-row': 'Mach Row', 'seated-cable-row': 'Cable Row', 'dumbbell-row': 'DB Row', 'bent-over-row': 'BB Row',
  'squat': 'Squat', 'front-squat': 'Front Squat', 'dumbbell-bulgarian-split-squat': 'BSS', 'bulgarian-split-squat': 'BSS',
  'romanian-deadlift': 'RDL', 'dumbbell-romanian-deadlift': 'DB RDL', 'deadlift': 'Deadlift',
  'seated-leg-curl': 'Leg Curl', 'lying-leg-curl': 'Lying Curl', 'leg-extension': 'Leg Ext', 'leg-press': 'Leg Press',
  'dumbbell-shoulder-press': 'DB OHP', 'shoulder-press': 'OHP', 'overhead-press': 'OHP',
  'dumbbell-lateral-raise': 'Lat Raise', 'dumbbell-curl': 'DB Curl', 'barbell-curl': 'BB Curl', 'hammer-curl': 'Hammer Curl',
  'tricep-pushdown': 'Pushdown', 'tricep-rope-pushdown': 'Rope Pushdown',
};

// Phrase → abbreviation, applied in order to any other exercise name.
const RULES: [RegExp, string][] = [
  [/\s*\(.*?\)/g, ''],
  [/hammer strength iso-lateral row/i, 'Iso Row'],
  [/romanian deadlift/i, 'RDL'], [/bulgarian split squat/i, 'BSS'], [/stiff leg deadlift/i, 'SLDL'],
  [/bench press/i, 'Bench'], [/overhead press|shoulder press|military press/i, 'OHP'],
  [/pull[ -]?ups?/i, 'Pull-up'], [/chin[ -]?ups?/i, 'Chin-up'], [/push[ -]?ups?/i, 'Push-up'],
  [/lateral raise/i, 'Lat Raise'], [/extension/i, 'Ext'],
  [/\bdumbbell\b/i, 'DB'], [/\bbarbell\b/i, 'BB'], [/\bmachine\b/i, 'Mach'], [/\bsmith mach\b/i, 'Smith'],
  [/\bincline\b/i, 'Inc'], [/\bdecline\b/i, 'Dec'], [/close grip/i, 'CG'], [/neutral grip/i, 'NG'], [/wide grip/i, 'WG'],
  [/single leg/i, 'SL'], [/one arm/i, '1-Arm'], [/\b(seated|standing|bodyweight)\b/gi, ''],
  [/\btriceps? /i, ''], [/\bbiceps? /i, ''],
];

export function shortExerciseName(exercise: Pick<Exercise, 'id' | 'name'> | undefined, fallbackId = '') {
  if (!exercise) return fallbackId.split('-').slice(0, 2).join(' ') || 'Exercise';
  if (SHORT[exercise.id]) return SHORT[exercise.id];
  let n = exercise.name;
  for (const [re, to] of RULES) n = n.replace(re, to);
  return n.replace(/\s+/g, ' ').trim() || exercise.name;
}

/** "3×Bench · 4×Squat · 3×Inc Bench": sets per exercise, in workout order (repeats merged). */
export function sessionSummary(session: Pick<Session, 'exercises'>, byId: Map<string, Exercise>) {
  const order: string[] = [], counts = new Map<string, number>();
  for (const e of session.exercises) {
    if (!counts.has(e.exerciseId)) order.push(e.exerciseId);
    counts.set(e.exerciseId, (counts.get(e.exerciseId) ?? 0) + e.sets.length);
  }
  return order.map(id => `${counts.get(id)}×${shortExerciseName(byId.get(id), id)}`).join(' · ');
}

/** What to show as a workout's title: the custom name, else the exercise summary. */
export function sessionTitle(session: Pick<Session, 'name' | 'exercises'>, byId: Map<string, Exercise>) {
  if (!isAutoName(session.name)) return session.name;
  return sessionSummary(session, byId) || 'Empty workout';
}
