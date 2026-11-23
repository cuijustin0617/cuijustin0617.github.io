import { useCallback, useEffect, useState } from 'react';
import type { WorkoutState } from '../shared/workout.ts';
import type { AccountUser } from '../shared/sync.ts';
import { addAccessibleExercise } from '../shared/recommendations.ts';
import { api, ApiError } from './lib/api.ts';
import { WoutProvider, reconcileInitial, useWout } from './lib/store.tsx';
import { go, useRoute } from './lib/hooks.ts';
import { Dock, Toasts } from './components/Dock.tsx';
import { ExercisePicker } from './components/ExercisePicker.tsx';
import { AuthScreen, SetupScreen } from './screens/Auth.tsx';
import { WorkoutScreen } from './screens/Workout.tsx';
import { ProgressScreen } from './screens/Progress.tsx';
import { HistoryScreen } from './screens/History.tsx';
import { ExercisesScreen } from './screens/Exercises.tsx';
import { ProfileScreen } from './screens/Profile.tsx';

type Boot =
  | { phase: 'loading' }
  | { phase: 'signed-out'; error?: string }
  | { phase: 'recovery' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; user: AccountUser; initial: { state: WorkoutState; revision: number; conflict?: { state: WorkoutState; revision: number }; fromDevice?: boolean } };

export function App() {
  const [boot, setBoot] = useState<Boot>({ phase: 'loading' });
  const load = useCallback(async () => {
    try {
      const res = await api.loadState();
      // Arrived from a password-reset email: choose a new password before entering the app.
      if (api.recoveryMode) { setBoot({ phase: 'recovery' }); return; }
      api.cleanUrl();
      setBoot({ phase: 'ready', user: res.user, initial: reconcileInitial(res.user.id, res) });
    } catch (e) {
      const urlError = api.urlError ?? undefined;
      api.cleanUrl();
      if (e instanceof ApiError && e.status === 401) setBoot({ phase: 'signed-out', error: urlError });
      else setBoot({ phase: 'error', message: (e as Error).message });
    }
  }, []);
  useEffect(() => { if (api.configured) void load(); }, [load]);
  const signedOut = useCallback(() => setBoot({ phase: 'signed-out' }), []);

  const reload = () => { setBoot({ phase: 'loading' }); void load(); };
  if (!api.configured) return <SetupScreen />;
  if (boot.phase === 'loading') return <div className="splash">Loading…</div>;
  if (boot.phase === 'signed-out') return <AuthScreen onSignedIn={reload} initialError={boot.error} />;
  if (boot.phase === 'recovery') return <AuthScreen onSignedIn={reload} initialMode="recovery" />;
  if (boot.phase === 'error') return (
    <div className="auth"><div className="card stack"><div className="card-title">Can’t reach Wout</div><div className="card-sub">{boot.message}</div>
      <button className="btn primary" onClick={() => { setBoot({ phase: 'loading' }); void load(); }}>Try again</button></div></div>
  );
  return (
    <WoutProvider key={boot.user.id} user={boot.user} initial={boot.initial} onSignedOut={signedOut}>
      <Shell />
    </WoutProvider>
  );
}

function Shell() {
  const [route, sub] = useRoute();
  const { state, update, rest, sync, syncMessage, resolveConflict } = useWout();
  const [picking, setPicking] = useState(false);
  const fab = route === 'workout'
    ? { label: 'Add exercise', icon: 'plus' as const, onClick: () => setPicking(true) }
    : { label: 'Search exercises', icon: 'search' as const, onClick: () => go('exercises') };

  return (
    <div className="app">
      <main className={'screen' + (rest ? ' has-rest' : '')}>
        {sync === 'conflict' && (
          <div className="banner warn" role="alert">
            <div className="grow">{syncMessage || 'Workouts changed on another device.'}</div>
            <button className="btn sm on-tertiary" onClick={() => void resolveConflict('cloud')}>Use cloud</button>
            <button className="btn sm tertiary" onClick={() => void resolveConflict('device')}>Keep this device</button>
          </div>
        )}
        {(sync === 'offline' || sync === 'error') && <div className="banner info" role="status">{syncMessage}</div>}
        {route === 'workout' && <WorkoutScreen onAddExercise={() => setPicking(true)} />}
        {route === 'progress' && <ProgressScreen tab={sub ?? 'strength'} />}
        {route === 'history' && <HistoryScreen />}
        {route === 'exercises' && <ExercisesScreen />}
        {route === 'profile' && <ProfileScreen />}
        {!['workout', 'progress', 'history', 'exercises', 'profile'].includes(route) && <div className="card empty"><strong>Page not found</strong><a href="#/workout">Go to workout</a></div>}
      </main>
      <Dock route={route} fab={fab} />
      <Toasts />
      {picking && (
        <ExercisePicker exclude={state.active?.exercises.map(e => e.exerciseId) ?? []} onClose={() => setPicking(false)}
          onPick={id => { update(s => addAccessibleExercise(s, id)); setPicking(false); if (route !== 'workout') go('workout'); }} />
      )}
    </div>
  );
}
