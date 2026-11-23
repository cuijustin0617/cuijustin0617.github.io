import { useMemo, useState } from 'react';
import { muscleTraining, muscleNames, muscles, type Muscle } from '../../shared/training-progress.ts';
import { addAccessibleExercise } from '../../shared/recommendations.ts';
import { rankBigGroups } from '../../shared/big-groups.ts';
import { BigGroupsCard } from '../components/BigGroups.tsx';
import { useWout } from '../lib/store.tsx';
import { go, useCatalog } from '../lib/hooks.ts';
import { ago, lb } from '../lib/format.ts';
import { BodyMap } from '../components/BodyMap.tsx';

const DAY = 86_400_000;
const PERIODS = { 7: { label: '7 days', scale: [5, 10] as [number, number] }, 30: { label: '30 days', scale: [15, 30] as [number, number] } };

export function MusclesTab() {
  const { state, update } = useWout();
  const { catalog, name } = useCatalog();
  const [days, setDays] = useState<7 | 30>(7);
  const [open, setOpen] = useState<Muscle | null>(null);
  const now = Date.now();
  const work = useMemo(() => muscleTraining(state, catalog, now - days * DAY, now, true), [state, catalog, days]);
  const bigGroups = useMemo(() => rankBigGroups(state, catalog, now), [state, catalog]);
  // Highlight the big group trained longest ago (unless it's already in today's workout).
  const next = bigGroups[0] && !bigGroups[0].inWorkout ? bigGroups[0] : null;
  const sets = Object.fromEntries(muscles.map(m => [m, work.entries[m].sets])) as Record<Muscle, number>;
  const ranked = muscles.filter(m => sets[m] > 0).sort((a, b) => sets[b] - sets[a]);
  const max = Math.max(1, ...ranked.map(m => sets[m]));
  const { scale } = PERIODS[days];

  const add = (id: string) => { if (update(s => addAccessibleExercise(s, id))) go('workout'); };
  const summary = ranked.length ? `Most trained: ${ranked.slice(0, 3).map(m => `${muscleNames[m]} ${lb(sets[m])} sets`).join(', ')}.` : 'No training logged in this period.';

  return (
    <>
      <section className="card hi">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 className="card-title">Sets by muscle</h2>
          <div className="seg sm" style={{ width: 170 }}>
            {([7, 30] as const).map(d => <button key={d} aria-pressed={days === d} onClick={() => setDays(d)}>{PERIODS[d].label}</button>)}
          </div>
        </div>
        <BodyMap sex={state.profile.sex} sets={sets} due={new Set(next ? next.muscles : [])} scale={scale}
          label={`Front and back body map. ${summary}${next ? ` Next up: ${next.name}.` : ''}`} />
        <div className="legend" style={{ marginTop: 6 }}>
          <span><i style={{ background: 'var(--heat-0)' }} />0</span>
          <span><i style={{ background: 'var(--heat-1)' }} />&lt;{scale[0]}</span>
          <span><i style={{ background: 'var(--heat-2)' }} />{scale[0]}–{scale[1] - 1}</span>
          <span><i style={{ background: 'var(--heat-3)' }} />{scale[1]}+ sets</span>
          {next && <span><i style={{ background: 'var(--heat-due)', borderRadius: 6 }} />Next up</span>}
        </div>
      </section>

      <BigGroupsCard groups={bigGroups} onAdd={add} />

      {ranked.length > 0 ? (
        <div className="group">
          {ranked.map(m => {
            const entry = work.entries[m];
            const isOpen = open === m;
            return (
              <div key={m}>
                <button className="list-row" style={{ minHeight: 44, display: 'grid', gridTemplateColumns: '120px minmax(0,1fr) 58px', gap: 10 }} onClick={() => setOpen(isOpen ? null : m)} aria-expanded={isOpen}>
                  <span className="t" style={{ fontSize: 14 }}>{muscleNames[m]}</span>
                  <span className="bar" role="img" aria-label={`${lb(entry.sets)} sets`}><div style={{ width: `${(entry.sets / max) * 100}%` }} /></span>
                  <span style={{ textAlign: 'right', fontWeight: 800 }}>{lb(entry.sets)} <span className="tiny muted" style={{ fontWeight: 600 }}>sets</span></span>
                </button>
                {isOpen && (
                  <div style={{ padding: '0 14px 10px' }} className="small muted">
                    Last trained {ago(entry.last)}.
                    {Object.entries(entry.exercises).sort((a, b) => b[1] - a[1]).map(([id, v]) => (
                      <div key={id} className="row" style={{ justifyContent: 'space-between' }}><span className="ellipsis">{name(id)}</span><span>{lb(v)}</span></div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card empty"><strong>Nothing logged in the last {PERIODS[days].label}</strong>Finished sets credit primary movers 1 set and supporting muscles ½.</div>
      )}
      <p className="tiny muted" style={{ padding: '0 4px' }}>
        Primary movers get 1 set, supporting muscles ½. Later exercises for the same body region on one day count 85% then 75%. This is a workload estimate, not a recovery model.
      </p>
    </>
  );
}
