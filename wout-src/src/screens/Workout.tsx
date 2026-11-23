import { useMemo, useRef, useState } from 'react';
import { addExercise, beginSession, finishSession, getPreviousSets, sessionStats, uid, type Session, type WorkoutState } from '../../shared/workout.ts';
import { addAccessibleExercise, suggestExercises } from '../../shared/recommendations.ts';
import { rankBigGroups, type BigGroupStatus } from '../../shared/big-groups.ts';
import { BigGroupsCard } from '../components/BigGroups.tsx';
import { DEFAULT_SESSION_NAME, isAutoName, sessionSummary, sessionTitle } from '../../shared/session-title.ts';
import { exerciseById } from '../../shared/catalog.ts';
import { latestBodyweight } from '../../shared/strength.ts';
import { useWout } from '../lib/store.tsx';
import { go, useCatalog, useNow } from '../lib/hooks.ts';
import { ago, dayLabel, whole } from '../lib/format.ts';
import { ExerciseCard, Menu } from '../components/ExerciseCard.tsx';
import { useImportWorkouts } from '../lib/importExport.ts';
import { Icon } from '../components/Icon.tsx';

export function repeatSession(state: WorkoutState, session: Session): WorkoutState {
  if (state.active) throw new Error('Finish or discard the current workout first.');
  let next: WorkoutState = { ...state, active: { id: uid(), name: session.name, startedAt: Date.now(), exercises: [] } };
  for (const e of session.exercises) next = addExercise(next, e.exerciseId);
  return next;
}

export function ProfileButton() {
  const { user } = useWout();
  const initials = user.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <a href="#/profile" className="icon-btn round" aria-label="Profile and settings" style={{ textDecoration: 'none', fontWeight: 800, fontSize: 14 }}>
      {initials || <Icon name="user" />}
    </a>
  );
}

export function WorkoutScreen({ onAddExercise }: { onAddExercise: () => void }) {
  const { state, update, startRest, stopRest, toast } = useWout();
  const { catalog } = useCatalog();
  const active = state.active;
  const minute = useNow(60_000);
  const suggestions = useMemo(() => suggestExercises(state, catalog, Date.now(), 4), [state, catalog, minute]);
  const bigGroups = useMemo(() => rankBigGroups(state, catalog, Date.now()), [state, catalog, minute]);

  const add = (id: string) => update(s => addAccessibleExercise(s, id));

  if (!active) return <IdleWorkout groups={bigGroups} onAdd={add} />;

  const bodyweight = latestBodyweight(state);
  const editActive = (fn: (s: Session) => Session, undo?: string) => update(s => (s.active ? { ...s, active: fn(s.active) } : s), undo);
  const finish = () => {
    if (update(s => finishSession(s))) { stopRest(); toast('Workout saved to history'); go('history'); }
  };
  const discard = () => {
    if (!window.confirm('Discard this workout? Completed sets in it will not be saved.')) return;
    stopRest();
    update(s => ({ ...s, active: null }), 'Workout discarded');
  };

  return (
    <>
      <div className="topbar" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <ActiveTitle session={active} onRename={name => editActive(s => (s.name === name ? s : { ...s, name }))} />
          <div className="subtitle">{dayLabel(active.startedAt)} · {active.exercises.length} exercise{active.exercises.length === 1 ? '' : 's'}</div>
        </div>
        <button className="btn dark" onClick={finish}>Finish</button>
        <Menu label="Workout options" items={[{ label: 'Discard workout', onClick: discard, danger: true }]} />
      </div>

      <ActiveHero session={active} />

      <BigGroupsCard groups={bigGroups} onAdd={add} />
      {suggestions.likely.length > 0 && (
        <div className="chips" aria-label="Likely next exercises">
          {suggestions.likely.map(s => (
            <button key={s.exercise.id} className="chip" onClick={() => add(s.exercise.id)} title={s.reason}>
              <Icon name="plus" size={15} stroke={2.6} />{s.exercise.name}
            </button>
          ))}
        </div>
      )}

      {active.exercises.length === 0 && (
        <div className="card empty"><strong>No exercises yet</strong>Add one with the + button or a suggestion above.</div>
      )}
      {active.exercises.map((logged, i) => (
        <ExerciseCard key={logged.id} logged={logged} mode="active" previous={getPreviousSets(state, logged.exerciseId)} bodyweight={bodyweight}
          canMoveUp={i > 0} canMoveDown={i < active.exercises.length - 1}
          onComplete={() => startRest()}
          onSets={(sets, undo) => editActive(s => ({ ...s, exercises: s.exercises.map(e => (e.id === logged.id ? { ...e, sets } : e)) }), undo)}
          onRemove={() => editActive(s => ({ ...s, exercises: s.exercises.filter(e => e.id !== logged.id) }), 'Exercise removed')}
          onMove={dir => editActive(s => {
            const list = [...s.exercises], j = i + dir;
            [list[i], list[j]] = [list[j], list[i]];
            return { ...s, exercises: list };
          })} />
      ))}
      <button className="btn tonal block" onClick={onAddExercise}><Icon name="plus" size={18} stroke={2.6} />Add exercise</button>
    </>
  );
}

/**
 * Workout title: a custom name, or the generated "3×Bench · 4×Squat" summary. Tap to rename;
 * clearing the name goes back to the automatic title.
 */
function ActiveTitle({ session, onRename }: { session: Session; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const auto = isAutoName(session.name);
  const title = sessionTitle(session, exerciseById);
  if (editing) {
    return (
      <input className="name-input" aria-label="Workout name (leave empty for automatic)" autoFocus maxLength={200}
        defaultValue={auto ? '' : session.name} placeholder={sessionSummary(session, exerciseById) || 'Workout name'}
        onBlur={e => { onRename(e.target.value.trim() || DEFAULT_SESSION_NAME); setEditing(false); }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false); }} />
    );
  }
  return (
    <button className="title-button" onClick={() => setEditing(true)} aria-label={`${title}. Rename workout`}>
      <h1 className={auto ? 'auto-title' : 'name-title'}>{title}</h1>
    </button>
  );
}

function ActiveHero({ session }: { session: Session }) {
  const stats = sessionStats(session);
  return (
    <section className="hero hero-tiles" aria-label="Workout summary">
      <div className="stat-row">
        <div className="stat"><div className="k">Sets done</div><div className="v xl">{stats.sets}<small> / {stats.total}</small></div></div>
        <div className="stat"><div className="k">Exercises</div><div className="v">{stats.exercises}</div></div>
        <div className="stat"><div className="k">Volume</div><div className="v">{whole(stats.volume)}<small> lb</small></div></div>
      </div>
    </section>
  );
}

function IdleWorkout({ groups, onAdd }: { groups: BigGroupStatus[]; onAdd: (id: string) => void }) {
  const { state, update } = useWout();
  const recent = state.history.slice(0, 3);
  const last = state.history[0];
  const importWorkouts = useImportWorkouts();
  const file = useRef<HTMLInputElement>(null);
  const fresh = state.history.length === 0 && !(state.bodyweights?.length);
  return (
    <>
      <div className="topbar">
        <h1 className="title">Workout</h1>
        <ProfileButton />
      </div>
      <section className="hero">
        <div style={{ fontSize: 22, lineHeight: '28px', fontWeight: 800, fontStretch: '105%' }}>Ready when you are</div>
        <div className="subtitle" style={{ marginTop: 2 }}>
          {last ? `Last: ${sessionTitle(last, exerciseById)} · ${ago(last.finishedAt ?? last.startedAt)}` : 'Start a workout and log your first sets.'}
        </div>
        <button className="btn primary lg block" style={{ marginTop: 12 }} onClick={() => update(beginSession)}>
          <Icon name="plus" size={20} stroke={2.6} />Start workout
        </button>
      </section>
      {fresh && (
        <section className="card row" style={{ gap: 12 }}>
          <Icon name="upload" />
          <div className="grow">
            <div style={{ fontWeight: 800 }}>Coming from the old Wout?</div>
            <div className="small muted">Import your wout-workouts.json to bring every workout, bodyweight and goal.</div>
          </div>
          <button className="btn sm tonal" onClick={() => file.current?.click()}>Import</button>
          <input ref={file} type="file" accept="application/json,.json" hidden aria-label="Import wout-workouts.json"
            onChange={e => { const f = e.target.files?.[0]; if (f) void importWorkouts(f); e.target.value = ''; }} />
        </section>
      )}
      {recent.length > 0 && (
        <>
          <div className="section-label">Repeat a workout</div>
          <div className="group">
            {recent.map(s => (
              <div key={s.id} className="list-row">
                <div className="grow">
                  <div className="t session-title">{sessionTitle(s, exerciseById)}</div>
                  <div className="s ellipsis">{dayLabel(s.finishedAt ?? s.startedAt)} · {s.exercises.length} exercises</div>
                </div>
                <button className="btn sm tonal" onClick={() => update(st => repeatSession(st, s))}><Icon name="repeat" size={15} />Repeat</button>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="section-label">Suggested focus</div>
      <BigGroupsCard groups={groups} onAdd={onAdd} />
    </>
  );
}
