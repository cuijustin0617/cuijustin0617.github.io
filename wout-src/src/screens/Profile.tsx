import { useRef, useState } from 'react';
import { latestBodyweight, logBodyweight } from '../../shared/strength.ts';
import { useWout } from '../lib/store.tsx';
import { api } from '../lib/api.ts';
import { exportWorkouts, useImportWorkouts } from '../lib/importExport.ts';
import { ago, lb } from '../lib/format.ts';
import { NumberInput } from '../components/ExerciseCard.tsx';
import { Icon } from '../components/Icon.tsx';

const SYNC_LABEL = { saved: 'All changes synced', saving: 'Saving…', pending: 'Saving soon…', offline: 'Offline · saved on this device', conflict: 'Needs your choice', error: 'Sync paused' } as const;

export function ProfileScreen() {
  const { user, state, update, sync, syncMessage, revision, lastSaved, signOut, toast, restDefault, setRestDefault } = useWout();
  const bw = latestBodyweight(state);
  const [weight, setWeight] = useState(bw ?? 0);
  const file = useRef<HTMLInputElement>(null);

  const importWorkouts = useImportWorkouts();
  const exportData = () => exportWorkouts(state);
  const importData = (f: File) => importWorkouts(f);

  return (
    <>
      <div className="topbar">
        <a href="#/workout" className="icon-btn round" aria-label="Back"><Icon name="chevronLeft" /></a>
        <h1 className="title grow">Profile</h1>
      </div>

      <section className="hero row" style={{ gap: 12 }}>
        <div className="brand-mark" style={{ width: 48, height: 48, fontSize: 18, fontWeight: 800 }}>{user.name.slice(0, 1).toUpperCase()}</div>
        <div className="grow">
          <div style={{ fontWeight: 800, fontSize: 18 }}>{user.name}</div>
          <div className="small muted ellipsis">{user.email}</div>
        </div>
      </section>

      <section className="card">
        <div className="row">
          <Icon name="cloud" />
          <div className="grow">
            <div style={{ fontWeight: 700 }}>{SYNC_LABEL[sync]}</div>
            <div className="small muted">{syncMessage || (lastSaved ? `Last saved ${ago(lastSaved)}` : `Revision ${revision}`)}</div>
          </div>
        </div>
      </section>

      <div className="section-label">Strength reference</div>
      <section className="card stack">
        <div className="seg" role="radiogroup" aria-label="Reference group">
          {(['male', 'female'] as const).map(sex => (
            <button key={sex} role="radio" aria-checked={state.profile.sex === sex} aria-pressed={state.profile.sex === sex}
              onClick={() => update(s => ({ ...s, profile: { ...s.profile, sex } }))}>{sex === 'male' ? 'Men' : 'Women'}</button>
          ))}
        </div>
        <div className="row">
          <NumberInput className="input" value={weight} onCommit={setWeight} label="Bodyweight in pounds" max={1500} />
          <button className="btn primary" disabled={!weight} onClick={() => update(s => logBodyweight(s, weight)) && toast('Bodyweight logged')}>Log bodyweight</button>
        </div>
        <div className="tiny muted">Current: {bw ? `${lb(bw)} lb` : 'not set'}. Percentiles use community strength standards without age adjustment.</div>
      </section>

      <div className="section-label">Rest timer</div>
      <section className="card">
        <div className="seg sm">
          {[60, 90, 120, 180, 240].map(s => <button key={s} aria-pressed={restDefault === s} onClick={() => setRestDefault(s)}>{s < 120 ? `${s}s` : `${s / 60}m`}</button>)}
        </div>
        <div className="tiny muted" style={{ marginTop: 6 }}>Starts automatically when you complete a set.</div>
      </section>

      <div className="section-label">Your data</div>
      <div className="group">
        <button className="list-row" onClick={exportData}><Icon name="download" /><div className="grow"><div className="t">Export workouts</div><div className="s">wout-workouts.json · {state.history.length} workouts</div></div></button>
        <button className="list-row" onClick={() => file.current?.click()}><Icon name="upload" /><div className="grow"><div className="t">Import workouts</div><div className="s">Replace with a Wout export</div></div></button>
        {api.canResetPassword && (
          <button className="list-row" onClick={async () => { try { await api.resetPassword(user.email); toast(`Password reset link sent to ${user.email}`); } catch (e) { toast((e as Error).message); } }}>
            <Icon name="edit" /><div className="grow"><div className="t">Change password</div><div className="s">Email me a reset link</div></div>
          </button>
        )}
        <button className="list-row" onClick={signOut} style={{ color: 'var(--error)' }}><Icon name="logout" /><div className="grow t">Sign out</div></button>
      </div>
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void importData(f); e.target.value = ''; }} />
      <p className="tiny muted" style={{ padding: '0 4px' }}>Exercise standards: Strength Level community data. Body diagrams: MuscleMap (MIT).</p>
    </>
  );
}
