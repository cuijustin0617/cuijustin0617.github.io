import { validateState, type WorkoutState } from '../../shared/workout.ts';
import { exerciseById } from '../../shared/catalog.ts';
import { useWout } from './store.tsx';

/** Import a wout-workouts.json export exactly as-is (IDs, order and timestamps preserved). */
export function useImportWorkouts() {
  const { state, update, toast } = useWout();
  return async (file: File) => {
    let data: unknown;
    try { data = JSON.parse(await file.text()); } catch { toast('Could not read that file.'); return false; }
    if (!validateState(data)) { toast('That file is not a valid Wout export.'); return false; }
    const imported = data as WorkoutState;
    const sets = imported.history.reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.sets.length, 0), 0);
    const unknown = new Set(imported.history.flatMap(s => s.exercises.map(e => e.exerciseId)).filter(id => !exerciseById.has(id)));
    const hasData = state.history.length > 0 || !!state.active || (state.bodyweights?.length ?? 0) > 0;
    const summary = `${imported.history.length} workouts, ${sets} sets, ${imported.bodyweights?.length ?? 0} bodyweight entries, ${imported.progressGoals?.length ?? 0} goals`;
    if (hasData && !window.confirm(`Replace everything in this account with the export (${summary})? You can undo right after.`)) return false;
    // Unknown exercise IDs are kept as-is (never deleted), per the migration rules.
    const ok = update(() => imported, `Imported ${summary}${unknown.size ? ` · ${unknown.size} unrecognized exercise(s) kept` : ''}`);
    return ok;
  };
}

export function exportWorkouts(state: WorkoutState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'wout-workouts.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
