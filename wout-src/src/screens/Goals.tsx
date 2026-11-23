import { useMemo, useState } from 'react';
import { DEFAULT_SERIES, chartDay, goalTime, localDate, progressPoints, projectTrend, targetPoints, validProgressSettings, type GoalReps, type LiftGoal, type ProgressGoal } from '../../shared/progress-goals.ts';
import { useWout } from '../lib/store.tsx';
import { useCatalog } from '../lib/hooks.ts';
import { lb, shortDate } from '../lib/format.ts';
import { LineChart } from '../components/LineChart.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { NumberInput } from '../components/ExerciseCard.tsx';
import { ExercisePicker } from '../components/ExercisePicker.tsx';
import { Icon } from '../components/Icon.tsx';

const DAY = 86_400_000;

export function GoalsTab() {
  const { state, update } = useWout();
  const { byId, name } = useCatalog();
  const [editing, setEditing] = useState<ProgressGoal | 'new' | null>(null);
  const [seriesOpen, setSeriesOpen] = useState(false);
  const goals = useMemo(() => [...(state.progressGoals ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [state.progressGoals]);
  const series = state.progressSeries ?? DEFAULT_SERIES;
  const now = Date.now();
  const today = chartDay(now);
  const futureGoal = goals.map(g => goalTime(g.date)).filter(t => t > today).at(-1);
  const end = futureGoal ?? today + 90 * DAY;

  const charts = useMemo(() => series.map(id => {
    const exercise = id === 'bodyweight' ? undefined : byId.get(id);
    if (id !== 'bodyweight' && !exercise) return null;
    const points = progressPoints(state, exercise, now);
    const targets = targetPoints(goals, exercise, state);
    const projection = projectTrend(points, today, end, 0);
    return { id, title: exercise?.name ?? 'Bodyweight', points, targets, projection };
  }).filter(Boolean) as { id: string; title: string; points: any[]; targets: any[]; projection: any[] }[], [series, state, goals, end]);

  const removeGoal = (date: string) => update(s => {
    const next = (s.progressGoals ?? []).filter(g => g.date !== date);
    const { progressGoals: _drop, ...rest } = s;
    return next.length ? { ...s, progressGoals: next } : rest;
  }, 'Goal deleted');

  return (
    <>
      <div className="section-label">Goals <span>{goals.length} of 3</span></div>
      {goals.length === 0 && <div className="card empty"><strong>No goals yet</strong>Set a dated target for bodyweight or a lift at 1, 5 or 8 reps.</div>}
      {goals.length > 0 && (
        <div className="group">
          {goals.map(g => {
            const days = Math.round((goalTime(g.date) - today) / DAY);
            return (
              <div key={g.date} className="list-row" style={{ alignItems: 'flex-start' }}>
                <Icon name="target" size={20} />
                <div className="grow">
                  <div className="t">{shortDate(goalTime(g.date) + new Date().getTimezoneOffset() * 60_000)} <span className="s">· {days > 0 ? `in ${days} days` : days === 0 ? 'today' : `${-days} days ago`}</span></div>
                  <div className="s">
                    {[g.bodyweight !== undefined ? `Bodyweight ${lb(g.bodyweight)} lb` : null, ...g.lifts.map(l => `${name(l.exerciseId)} ${lb(l.weight)} × ${l.reps}`)].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <button className="icon-btn plain sm" onClick={() => setEditing(g)} aria-label="Edit goal"><Icon name="edit" size={17} /></button>
                <button className="icon-btn plain sm" onClick={() => removeGoal(g.date)} aria-label="Delete goal"><Icon name="trash" size={17} /></button>
              </div>
            );
          })}
        </div>
      )}
      <div className="row" style={{ gap: 6 }}>
        <button className="btn tonal" disabled={goals.length >= 3} onClick={() => setEditing('new')}><Icon name="plus" size={16} stroke={2.6} />Add goal</button>
        <button className="btn ghost" onClick={() => setSeriesOpen(true)}>Choose charts</button>
      </div>

      {charts.map(c => {
        const last = c.points.at(-1);
        const target = c.targets.find(t => t.at >= today) ?? c.targets.at(-1);
        return (
          <section key={c.id} className="card hi">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2 className="card-title ellipsis">{c.title}</h2>
              <div className="small muted" style={{ flexShrink: 0 }}>
                {last ? <><strong style={{ color: 'var(--ink)' }}>{lb(last.value, 0)} lb</strong>{c.id === 'bodyweight' ? '' : ' est. 1RM'}</> : 'No logs'}
                {target ? ` · goal ${lb(target.value, 0)}` : ''}
              </div>
            </div>
            {c.points.length || c.targets.length
              ? <LineChart points={c.points} targets={c.targets} projection={c.projection} label={`${c.title} history and projection`} />
              : <div className="empty small" style={{ padding: 10 }}>Log this {c.id === 'bodyweight' ? 'measurement' : 'lift'} to start a trend.</div>}
            {c.projection[0]?.note && <div className="tiny muted">{c.projection[0].note}. Dashed line is a scenario, not a guarantee.</div>}
          </section>
        );
      })}

      {editing && <GoalEditor goal={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {seriesOpen && <SeriesEditor onClose={() => setSeriesOpen(false)} />}
    </>
  );
}

function GoalEditor({ goal, onClose }: { goal: ProgressGoal | null; onClose: () => void }) {
  const { state, update, toast } = useWout();
  const { name } = useCatalog();
  const [date, setDate] = useState(goal?.date ?? localDate(Date.now() + 84 * DAY));
  const [bodyweight, setBodyweight] = useState<number>(goal?.bodyweight ?? 0);
  const [lifts, setLifts] = useState<LiftGoal[]>(goal?.lifts ?? []);
  const [picking, setPicking] = useState(false);

  const save = () => {
    const next: ProgressGoal = { date, lifts, ...(bodyweight > 0 ? { bodyweight } : {}) };
    const others = (state.progressGoals ?? []).filter(g => g.date !== goal?.date);
    if (others.some(g => g.date === date)) return toast('Another goal already uses that date.');
    if (!next.lifts.length && next.bodyweight === undefined) return toast('Add a bodyweight target or at least one lift.');
    const progressGoals = [...others, next];
    if (!validProgressSettings({ ...state, progressGoals })) return toast('Check the date and targets.');
    if (update(s => ({ ...s, progressGoals }))) onClose();
  };

  return (
    <Sheet title={goal ? 'Edit goal' : 'New goal'} onClose={onClose}>
      <div className="field"><label htmlFor="goal-date">Target date</label>
        <input id="goal-date" type="date" className="input on-surface" value={date} onChange={e => setDate(e.target.value)} /></div>
      <div className="field"><span className="label">Bodyweight target (optional, lb)</span>
        <NumberInput className="input on-surface" value={bodyweight} onCommit={setBodyweight} label="Bodyweight target in pounds" max={1500} /></div>
      <div className="section-label" style={{ padding: '4px 4px 0' }}>Lifts</div>
      {lifts.map((l, i) => (
        <div key={l.exerciseId} className="card">
          <div className="row"><div className="grow" style={{ fontWeight: 700 }}>{name(l.exerciseId)}</div>
            <button className="icon-btn plain sm" aria-label="Remove lift" onClick={() => setLifts(ls => ls.filter((_, j) => j !== i))}><Icon name="close" size={17} /></button></div>
          <div className="row" style={{ marginTop: 6 }}>
            <NumberInput className="input" value={l.weight} onCommit={w => setLifts(ls => ls.map((x, j) => (j === i ? { ...x, weight: w } : x)))} label="Target weight in pounds" />
            <div className="seg sm" style={{ width: 150, flexShrink: 0 }}>
              {([1, 5, 8] as GoalReps[]).map(r => <button key={r} aria-pressed={l.reps === r} onClick={() => setLifts(ls => ls.map((x, j) => (j === i ? { ...x, reps: r } : x)))}>× {r}</button>)}
            </div>
          </div>
        </div>
      ))}
      <button className="btn tonal" onClick={() => setPicking(true)}><Icon name="plus" size={16} stroke={2.6} />Add lift</button>
      <button className="btn primary lg block" onClick={save}>Save goal</button>
      {picking && <ExercisePicker title="Goal lift" exclude={lifts.map(l => l.exerciseId)} onClose={() => setPicking(false)}
        onPick={id => { setLifts(ls => [...ls, { exerciseId: id, weight: 0, reps: 5 }]); setPicking(false); }} />}
    </Sheet>
  );
}

function SeriesEditor({ onClose }: { onClose: () => void }) {
  const { state, update } = useWout();
  const { name } = useCatalog();
  const series = state.progressSeries ?? DEFAULT_SERIES;
  const logged = new Set<string>();
  for (const s of state.history) for (const e of s.exercises) logged.add(e.exerciseId);
  const options = [...new Set(['bodyweight', ...series, ...logged])];
  const toggle = (id: string) => update(s => {
    const cur = s.progressSeries ?? DEFAULT_SERIES;
    return { ...s, progressSeries: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] };
  });
  return (
    <Sheet title="Charts" onClose={onClose}>
      <div className="group">
        {options.map(id => (
          <label key={id} className="list-row" style={{ minHeight: 46, cursor: 'pointer' }}>
            <span className="grow t">{id === 'bodyweight' ? 'Bodyweight' : name(id)}</span>
            <input type="checkbox" checked={series.includes(id)} onChange={() => toggle(id)} style={{ width: 20, height: 20, accentColor: 'var(--primary)' }} />
          </label>
        ))}
      </div>
    </Sheet>
  );
}
