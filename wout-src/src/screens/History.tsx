import { useMemo, useState } from 'react';
import { dateInputValue, editSession, sessionStats, setSessionDate, getPreviousSets, type Session } from '../../shared/workout.ts';
import { addAccessibleExercise } from '../../shared/recommendations.ts';
import { latestBodyweight } from '../../shared/strength.ts';
import { useWout } from '../lib/store.tsx';
import { go, useCatalog } from '../lib/hooks.ts';
import { dayLabel, lb, monthLabel, whole } from '../lib/format.ts';
import { ExerciseCard } from '../components/ExerciseCard.tsx';
import { ExercisePicker } from '../components/ExercisePicker.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { Icon } from '../components/Icon.tsx';
import { ProfileButton, repeatSession } from './Workout.tsx';

/** Latest timestamp in a session (start, finish or any set). */
function latestTime(s: Session) {
  return Math.max(s.startedAt, s.finishedAt ?? 0, ...s.exercises.flatMap(e => e.sets.map(x => x.completedAt ?? 0)));
}

/**
 * Moving a workout to a date keeps its time of day, so moving an evening workout to "today"
 * can land it in the future, where workload and suggestions ignore it. Shift it back to now.
 */
function notInFuture(s: Session): Session {
  const shift = Math.min(0, Date.now() - latestTime(s));
  if (!shift) return s;
  const at = (t: number) => t + shift;
  return { ...s, startedAt: at(s.startedAt), ...(s.finishedAt === undefined ? {} : { finishedAt: at(s.finishedAt) }),
    exercises: s.exercises.map(e => ({ ...e, sets: e.sets.map(x => (x.completedAt === undefined ? x : { ...x, completedAt: at(x.completedAt) })) })) };
}

export function HistoryScreen() {
  const { state, update } = useWout();
  const { name } = useCatalog();
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const sessions = useMemo(() => [...state.history].sort((a, b) => (b.finishedAt ?? b.startedAt) - (a.finishedAt ?? a.startedAt)), [state.history]);
  const months = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) { const k = monthLabel(s.finishedAt ?? s.startedAt); map.set(k, [...(map.get(k) ?? []), s]); }
    return [...map.entries()];
  }, [sessions]);

  const repeat = (s: Session) => { if (update(st => repeatSession(st, s))) go('workout'); };
  const remove = (s: Session) => update(st => ({ ...st, history: st.history.filter(h => h.id !== s.id) }), 'Workout deleted');

  return (
    <>
      <div className="topbar">
        <h1 className="title">History</h1>
        <ProfileButton />
      </div>
      {sessions.length === 0 && <div className="card empty"><strong>No finished workouts yet</strong>Finish a workout and it appears here.</div>}
      {months.map(([month, list]) => (
        <section key={month}>
          <div className="section-label">{month} <span>{list.length} workout{list.length > 1 ? 's' : ''}</span></div>
          <div className="group" style={{ marginTop: 6 }}>
            {list.map(s => {
              const stats = sessionStats(s);
              const isOpen = open === s.id;
              return (
                <div key={s.id}>
                  <button className="list-row" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}>
                    <div className="grow">
                      <div className="t ellipsis">{s.name}</div>
                      <div className="s ellipsis">
                        {dayLabel(s.finishedAt ?? s.startedAt)} · {stats.sets} sets · {s.exercises.length} exercises · {whole(stats.volume)} lb
                      </div>
                      {latestTime(s) > Date.now() && <div className="tiny" style={{ color: 'var(--tertiary)', fontWeight: 700 }}>Dated later than now · not counted until then. Edit to fix the date.</div>}
                    </div>
                    <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={18} />
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 14px 12px' }}>
                      {s.exercises.map(e => (
                        <div key={e.id} className="row small" style={{ alignItems: 'baseline', padding: '3px 0' }}>
                          <span className="grow ellipsis" style={{ fontWeight: 700 }}>{name(e.exerciseId)}</span>
                          <span className="muted" style={{ flexShrink: 0 }}>{e.sets.map(x => `${lb(x.weight)}×${x.reps}`).join('  ')}</span>
                        </div>
                      ))}
                      <div className="row" style={{ gap: 6, marginTop: 8 }}>
                        <button className="btn sm primary" onClick={() => repeat(s)}><Icon name="repeat" size={15} />Repeat</button>
                        <button className="btn sm tonal" onClick={() => setEditing(s.id)}><Icon name="edit" size={15} />Edit</button>
                        <button className="btn sm danger" onClick={() => remove(s)}><Icon name="trash" size={15} />Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {editing && <SessionEditor id={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function SessionEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, update, toast } = useWout();
  const [picking, setPicking] = useState(false);
  const session = state.history.find(h => h.id === id);
  if (!session) return null;
  const edit = (fn: (s: Session) => Session, undo?: string) => update(st => editSession(st, id, fn), undo);
  const bodyweight = latestBodyweight(state);
  // "Previous" for an edited session = the latest earlier session with that exercise.
  const earlier = { ...state, history: state.history.filter(h => (h.finishedAt ?? h.startedAt) < (session.finishedAt ?? session.startedAt)) };

  return (
    <Sheet title="Edit workout" onClose={onClose}>
      <div className="row" style={{ gap: 6 }}>
        <input className="input on-surface grow" aria-label="Workout name" defaultValue={session.name} maxLength={200}
          onBlur={e => { const n = e.target.value.trim(); if (n && n !== session.name) edit(s => ({ ...s, name: n })); }} />
        <input type="date" className="input on-surface" style={{ width: 160 }} aria-label="Workout date" value={dateInputValue(session.finishedAt ?? session.startedAt)}
          max={dateInputValue(Date.now())}
          onChange={e => { if (!e.target.value) return; try { edit(s => notInFuture(setSessionDate(s, e.target.value))); } catch (err) { toast((err as Error).message); } }} />
      </div>
      {session.exercises.map((logged, i) => (
        <ExerciseCard key={logged.id} logged={logged} mode="history" previous={getPreviousSets(earlier, logged.exerciseId)} bodyweight={bodyweight}
          canMoveUp={i > 0} canMoveDown={i < session.exercises.length - 1}
          onSets={(sets, undo) => edit(s => ({ ...s, exercises: s.exercises.map(e => (e.id === logged.id ? { ...e, sets } : e)) }), undo)}
          onRemove={() => edit(s => ({ ...s, exercises: s.exercises.filter(e => e.id !== logged.id) }), 'Exercise removed')}
          onMove={dir => edit(s => { const list = [...s.exercises], j = i + dir; [list[i], list[j]] = [list[j], list[i]]; return { ...s, exercises: list }; })} />
      ))}
      <button className="btn tonal" onClick={() => setPicking(true)}><Icon name="plus" size={16} stroke={2.6} />Add exercise</button>
      <p className="tiny muted">Sets with at least one rep count as completed. Changes save automatically.</p>
      {picking && <ExercisePicker onClose={() => setPicking(false)} onPick={exerciseId => {
        // Historical sets get a completion time on the session's day.
        update(st => {
          const next = addAccessibleExercise(st, exerciseId, id);
          return editSession(next, id, s => ({ ...s, exercises: s.exercises.map((e, k) => (k === s.exercises.length - 1 ? { ...e, sets: e.sets.map(x => ({ ...x, done: x.reps >= 1, completedAt: x.reps >= 1 ? (s.finishedAt ?? s.startedAt) : undefined })) } : e)) }));
        });
        setPicking(false);
      }} />}
    </Sheet>
  );
}
