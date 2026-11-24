import { useMemo, useState } from 'react';
import { muscleTraining, muscleNames, muscles, type Muscle } from '../../shared/training-progress.ts';
import { addAccessibleExercise } from '../../shared/recommendations.ts';
import { rankBigGroups } from '../../shared/big-groups.ts';
import { BigGroupsCard } from '../components/BigGroups.tsx';
import { sinceLabel } from '../../shared/big-groups.ts';
import { Icon } from '../components/Icon.tsx';
import { getStyle } from '../lib/theme.ts';
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

  const listBlock = (ranked.length > 0 ? (
        <div className="group">
          {ranked.map(m => {
            const entry = work.entries[m];
            const isOpen = open === m;
            return (
              <div key={m}>
                <button className="list-row" style={{ minHeight: 44, display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr) auto', gap: 12 }} onClick={() => setOpen(isOpen ? null : m)} aria-expanded={isOpen}>
                  <span className="t ellipsis" style={{ fontSize: 14 }}>{muscleNames[m]}</span>
                  <span className="bar" role="img" aria-label={`${lb(entry.sets)} sets`}><div style={{ width: `${(entry.sets / max) * 100}%` }} /></span>
                  <span style={{ textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap', minWidth: 64 }}>{lb(entry.sets)} <span className="tiny muted" style={{ fontWeight: 600 }}>sets</span></span>
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
      ));
  const footnote = (
    <p className="tiny muted" style={{ padding: '0 4px' }}>
      Primary movers get 1 set, supporting muscles ½. Later exercises for the same body region on one day count 85% then 75%. This is a workload estimate, not a recovery model.
    </p>
  );

  if (getStyle() === 'bento') {
    const [most, ...others] = ranked;
    const tileName = (m: Muscle) => (m === 'upper-back' ? 'Lats & back' : muscleNames[m]);
    return (
      <>
        <section className="card hi">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 className="card-title">Sets by muscle</h2>
            <label className="bento-select">
              <span className="sr-only">Period</span>
              <select value={days} onChange={e => setDays(Number(e.target.value) as 7 | 30)}>
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
              </select>
              <Icon name="chevronDown" size={16} stroke={2.4} />
            </label>
          </div>
          <BodyMap sex={state.profile.sex} sets={sets} due={new Set(next ? next.muscles : [])} scale={scale}
            label={`Front and back body map. ${summary}${next ? ` Next up: ${next.name}.` : ''}`} />
          <div className="legend" style={{ marginTop: 6 }}>
            <span><i style={{ background: 'var(--heat-0)', borderRadius: 6 }} />0</span>
            <span><i style={{ background: 'var(--heat-1)', borderRadius: 6 }} />1–{scale[0] - 1}</span>
            <span><i style={{ background: 'var(--heat-2)', borderRadius: 6 }} />{scale[0]}–{scale[1] - 1}</span>
            <span><i style={{ background: 'var(--heat-3)', borderRadius: 6 }} />{scale[1]}+ sets</span>
            {next && <span><i style={{ background: 'var(--heat-due)', borderRadius: 6 }} />Due</span>}
          </div>
        </section>

        <div className="bento-due-row">
          {next ? (
            <section className="bento-tile peach bento-due">
              <div className="bento-tile-title">{next.name} due</div>
              <div className="tiny muted">{sinceLabel(next.daysAgo)} · {next.sets7d ? `${next.sets7d} set${next.sets7d === 1 ? '' : 's'} this week` : 'no sets this week'}</div>
              {next.options[0] && (
                <button className="btn sm bento-white-btn" onClick={() => add(next.options[0].id)}>
                  <Icon name="plus" size={14} stroke={2.8} />{next.options[0].name}
                </button>
              )}
            </section>
          ) : (
            <section className="bento-tile peach bento-due"><div className="bento-tile-title">All big groups in this workout</div></section>
          )}
          <section className="bento-tile lilac bento-most">
            <div className="tiny" style={{ fontWeight: 700 }}>Most worked</div>
            <div className="bento-tile-big">{most ? lb(sets[most]) : '0'}</div>
            <div className="tiny" style={{ fontWeight: 700 }}>{most ? `${tileName(most)} sets` : 'No sets yet'}</div>
          </section>
        </div>

        {others.length > 0 && (
          <div className="bento-tiles-3">
            {others.slice(0, 3).map((m, i) => (
              <div key={m} className={'bento-tile ' + ['sky', 'mint', 'white'][i]}>
                <div className="bento-tile-num">{lb(sets[m])}</div>
                <div className="tiny" style={{ fontWeight: 700 }}>{tileName(m)}</div>
              </div>
            ))}
          </div>
        )}

        {ranked.length > 4 && <div className="section-label">All muscles</div>}
        {ranked.length > 4 ? listBlock : ranked.length === 0 ? listBlock : null}
        {footnote}
      </>
    );
  }

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

      {listBlock}
      <p className="tiny muted" style={{ padding: '0 4px' }}>
        Primary movers get 1 set, supporting muscles ½. Later exercises for the same body region on one day count 85% then 75%. This is a workload estimate, not a recovery model.
      </p>
    </>
  );
}
