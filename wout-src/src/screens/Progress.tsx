import { useMemo, useState } from 'react';
import { strengthLeaderboard, latestBodyweight, logBodyweight } from '../../shared/strength.ts';
import { exerciseRegions } from '../../shared/training-progress.ts';
import type { Exercise } from '../../shared/workout.ts';
import { useWout } from '../lib/store.tsx';
import { useCatalog } from '../lib/hooks.ts';
import { lb } from '../lib/format.ts';
import { LiftRow, type Ranked } from '../components/LiftRow.tsx';
import { NumberInput } from '../components/ExerciseCard.tsx';
import { ProfileButton } from './Workout.tsx';
import { MusclesTab } from './Muscles.tsx';
import { WeightTab } from './Weight.tsx';
import { GoalsTab } from './Goals.tsx';

const TABS = [['weight', 'Weight'], ['strength', 'Strength'], ['muscles', 'Muscles'], ['goals', 'Goals']] as const;

export function ProgressScreen({ tab }: { tab: string }) {
  const current = TABS.some(([id]) => id === tab) ? tab : 'strength';
  return (
    <>
      <div className="topbar">
        <h1 className="title">Progress</h1>
        <ProfileButton />
      </div>
      <div className="seg" role="tablist" aria-label="Progress views">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={current === id} onClick={() => { window.location.hash = '/progress/' + id; }}>{label}</button>
        ))}
      </div>
      {current === 'weight' && <WeightTab />}
      {current === 'strength' && <StrengthTab />}
      {current === 'muscles' && <MusclesTab />}
      {current === 'goals' && <GoalsTab />}
    </>
  );
}

/** Display-only grouping: dips under Chest, all leg work under Legs. */
function displayGroup(e: Exercise) {
  if (/\bdips?\b/i.test(e.name)) return 'Chest';
  const regions = exerciseRegions(e);
  if (e.bodypart === 'Legs' || (regions.includes('lower') && !regions.includes('upper'))) return 'Legs';
  return e.bodypart === 'Whole Body' ? 'Whole body' : e.bodypart;
}
const ORDER = ['Chest', 'Back', 'Shoulders', 'Legs', 'Biceps', 'Triceps', 'Forearms', 'Core', 'Whole body'];

function StrengthTab() {
  const { state, update } = useWout();
  const { catalog } = useCatalog();
  const board = useMemo(() => strengthLeaderboard(state, catalog), [state, catalog]);
  const bw = latestBodyweight(state);
  const sexLabel = state.profile.sex === 'male' ? 'Men' : 'Women';
  const [draft, setDraft] = useState(0);

  if (!bw) {
    return (
      <section className="card">
        <div className="card-title">Log your bodyweight to rank lifts</div>
        <div className="card-sub" style={{ marginBottom: 10 }}>Strength standards depend on bodyweight. Stored in pounds.</div>
        <div className="row">
          <NumberInput className="input" value={draft} onCommit={setDraft} label="Bodyweight in pounds" max={1500} />
          <button className="btn primary" disabled={!draft} onClick={() => update(s => logBodyweight(s, draft))}>Log bodyweight</button>
        </div>
      </section>
    );
  }

  const percentileRows = board.ranked.filter(r => r.rankingKind === 'percentile');
  const top = percentileRows[0];
  const groups = new Map<string, Ranked[]>();
  for (const r of board.ranked) {
    const g = displayGroup(r.exercise);
    groups.set(g, [...(groups.get(g) ?? []), r]);
  }
  const ordered = [...groups.entries()].sort((a, b) => (ORDER.indexOf(a[0]) + 99) % 99 - (ORDER.indexOf(b[0]) + 99) % 99);

  return (
    <>
      <div className="row small muted" style={{ padding: '0 4px', justifyContent: 'space-between' }}>
        <span>Compared with {sexLabel.toLowerCase()} at {lb(bw, 0)} lb bodyweight</span>
        <a href="#/profile" className="btn sm ghost" style={{ textDecoration: 'none' }}>Change</a>
      </div>
      {top && (
        <section className="hero dark row" style={{ gap: 12 }} aria-label="Top lift">
          <div className="grow">
            <div className="tiny" style={{ fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.85 }}>Top lift</div>
            <div style={{ fontSize: 19, lineHeight: '23px', fontWeight: 800, fontStretch: '105%' }}>{top.exercise.name}</div>
            <div className="small" style={{ opacity: 0.9 }}>{top.percentile.level} · {top.percentile.label} of {sexLabel.toLowerCase()}</div>
          </div>
          <PercentBadge value={top.percentile.value} label={top.percentile.label} />
        </section>
      )}
      {board.ranked.length === 0 && (
        <div className="card empty"><strong>No ranked lifts yet</strong>Complete a set of 1–30 reps on a lift with standards to see where you stand.</div>
      )}
      {ordered.map(([name, rows]) => (
        <section key={name}>
          <div className="section-label">{name}</div>
          <div className="group" style={{ marginTop: 6 }}>
            {rows.map(r => <LiftRow key={r.exercise.id} r={r} sexLabel={sexLabel} />)}
          </div>
        </section>
      ))}
      {board.unranked.length > 0 && (
        <section>
          <div className="section-label">Not ranked</div>
          <div className="group" style={{ marginTop: 6 }}>
            {board.unranked.map(u => (
              <div key={u.exercise.id} className="list-row" style={{ minHeight: 44 }}>
                <div className="grow"><div className="t" style={{ fontSize: 14 }}>{u.exercise.name}</div><div className="s">{u.reason}</div></div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/** Expressive scalloped badge. */
function PercentBadge({ value, label }: { value: number; label: string }) {
  const text = label.startsWith('<') || label.startsWith('>') ? label.replace('%', '') : String(Math.round(value));
  return (
    <div style={{ position: 'relative', width: 76, height: 76, flexShrink: 0 }} aria-hidden="true">
      <svg width="76" height="76" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="38" fill="var(--badge-fill, var(--primary-c))" />
        <circle cx="50" cy="50" r="38" fill="none" stroke="var(--badge-fill, var(--primary-c))" strokeWidth="13" strokeLinecap="round" strokeDasharray="0.1 19.796" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--badge-ink, var(--on-primary-c))', fontSize: 22, fontWeight: 800, fontStretch: '90%' }}>
        {text}<span style={{ fontSize: 12 }}>%</span>
      </div>
    </div>
  );
}
