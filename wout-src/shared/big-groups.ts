import type { Exercise, Session, WorkoutState } from './workout.ts';
import { setTime, trainingSessions, type Muscle } from './training-progress.ts';

/**
 * The five independent "big groups" used for balance suggestions. Every exercise belongs to at
 * most one group, matched by name. Suggestions rank the groups by how long ago each was trained.
 */
export type BigGroupId = 'chest' | 'vertical-back' | 'horizontal-back' | 'hamstrings' | 'quads';

export const BIG_GROUPS: { id: BigGroupId; name: string; muscles: Muscle[]; starters: string[] }[] = [
  { id: 'chest', name: 'Heavy chest', muscles: ['chest'], starters: ['bench-press', 'dips', 'incline-bench-press'] },
  { id: 'vertical-back', name: 'Vertical back', muscles: ['upper-back'], starters: ['pull-ups', 'lat-pulldown', 'neutral-grip-pull-ups'] },
  { id: 'horizontal-back', name: 'Horizontal back', muscles: ['upper-back'], starters: ['machine-row', 'seated-cable-row', 'dumbbell-row'] },
  { id: 'hamstrings', name: 'Hamstrings', muscles: ['hamstring'], starters: ['romanian-deadlift', 'lying-leg-curl', 'seated-leg-curl'] },
  { id: 'quads', name: 'Quads', muscles: ['quadriceps'], starters: ['squat', 'dumbbell-bulgarian-split-squat', 'front-squat'] },
];

/** Which big group an exercise trains, or null (smaller muscles, accessories, other patterns). */
export function bigGroupOf(exercise: Pick<Exercise, 'name'>): BigGroupId | null {
  const n = exercise.name.toLowerCase();
  // Heavy chest: any bench press (incl. machine chest press), dips, chest flies.
  if (/reverse fly|rear delt/.test(n)) return null;
  if (/bench press|chest press|floor press|\bfly\b|\bflye?s?\b|pec deck|crossover/.test(n)) return 'chest';
  if (/\bdips?\b/.test(n) && !/bench dip/.test(n)) return 'chest';
  // Vertical back: pull-ups, chin-ups, lat pulldowns.
  if (/pull[ -]?ups?\b|chin[ -]?ups?\b|lat pulldown|close grip pulldown|wide grip pulldown|^pulldown/.test(n) && !/straight arm/.test(n)) return 'vertical-back';
  // Horizontal back: rows (machine, iso-lateral, cable, dumbbell, barbell...), not upright rows.
  if (/\brows?\b/.test(n) && !/upright/.test(n)) return 'horizontal-back';
  // Hamstrings: Romanian / stiff-leg deadlifts and leg curls. Squats do not count here.
  if (/romanian deadlift|\brdl\b|stiff[ -]leg|leg curl|hamstring curl|nordic|glute ham/.test(n)) return 'hamstrings';
  // Quads: any squat (back, front, goblet, split, Bulgarian, hack, Smith...).
  if (/squat/.test(n) && !/squat thrust/.test(n)) return 'quads';
  return null;
}

export type BigGroupStatus = {
  id: BigGroupId; name: string; muscles: Muscle[];
  /** Latest completed set in this group (ms), or null if never trained. */
  last: number | null;
  /** Calendar days since `last` (0 = today), or null if never trained. */
  daysAgo: number | null;
  sets7d: number;
  /** Already in the current workout. */
  inWorkout: boolean;
  /** Up to 3 exercises to add: the ones you use most in this group first. */
  options: Exercise[];
};

const DAY = 86_400_000;
const startOfDay = (at: number) => { const d = new Date(at); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** Rank the five big groups: not trained longest first; groups already in this workout last. */
export function rankBigGroups(state: WorkoutState, catalog: Exercise[], now = Date.now()): BigGroupStatus[] {
  const byId = new Map(catalog.map(e => [e.id, e]));
  const last = new Map<BigGroupId, number>(), sets7d = new Map<BigGroupId, number>();
  const uses = new Map<string, number>();
  const activeId = state.active?.id;
  for (const session of trainingSessions(state)) for (const logged of session.exercises) {
    const exercise = byId.get(logged.exerciseId);
    const group = exercise ? bigGroupOf(exercise) : null;
    let used = false;
    for (const set of logged.sets) {
      const at = setTime(session as Session, set.completedAt);
      if (!set.done || set.reps < 1 || at > now) continue;
      used = true;
      if (group) {
        last.set(group, Math.max(last.get(group) ?? 0, at));
        if (at >= now - 7 * DAY) sets7d.set(group, (sets7d.get(group) ?? 0) + 1);
      }
    }
    if (used && session.id !== activeId) uses.set(logged.exerciseId, (uses.get(logged.exerciseId) ?? 0) + 1);
  }
  const planned = new Set((state.active?.exercises ?? []).map(e => byId.get(e.exerciseId)).filter(Boolean).map(e => bigGroupOf(e!)));
  const access = new Set([...state.favorites, ...(state.accessibleExercises ?? []), ...uses.keys()]);

  return BIG_GROUPS.map(g => {
    const at = last.get(g.id) ?? null;
    const usable = catalog.filter(e => bigGroupOf(e) === g.id && access.has(e.id) && !state.active?.exercises.some(x => x.exerciseId === e.id));
    usable.sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0) || a.name.localeCompare(b.name));
    const options = usable.length ? usable.slice(0, 3) : g.starters.map(id => byId.get(id)).filter((e): e is Exercise => !!e);
    return {
      id: g.id, name: g.name, muscles: g.muscles, last: at,
      daysAgo: at === null ? null : Math.round((startOfDay(now) - startOfDay(at)) / DAY),
      sets7d: sets7d.get(g.id) ?? 0, inWorkout: planned.has(g.id), options,
    };
  }).sort((a, b) =>
    Number(a.inWorkout) - Number(b.inWorkout)
    || (a.last ?? -1) - (b.last ?? -1)
    || a.sets7d - b.sets7d
    || BIG_GROUPS.findIndex(g => g.id === a.id) - BIG_GROUPS.findIndex(g => g.id === b.id));
}

export function sinceLabel(daysAgo: number | null) {
  if (daysAgo === null) return 'Not trained yet';
  if (daysAgo <= 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  return `${daysAgo} days ago`;
}
