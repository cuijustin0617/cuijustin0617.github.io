import { useMemo, useState } from 'react';
import { latestBodyweight, logBodyweight } from '../../shared/strength.ts';
import { useWout } from '../lib/store.tsx';
import { dateTimeInput, dayLabel, lb, timeOfDay } from '../lib/format.ts';
import { LineChart } from '../components/LineChart.tsx';
import { NumberInput } from '../components/ExerciseCard.tsx';
import { Icon } from '../components/Icon.tsx';

const DAY = 86_400_000;
const RANGES = [[30, '1M'], [90, '3M'], [365, '1Y'], [0, 'All']] as const;

export function WeightTab() {
  const { state, update } = useWout();
  const entries = useMemo(() => [...(state.bodyweights ?? [])].sort((a, b) => b.recordedAt - a.recordedAt), [state.bodyweights]);
  const latest = latestBodyweight(state);
  const [weight, setWeight] = useState(latest ?? 0);
  const [when, setWhen] = useState('');
  const [range, setRange] = useState<number>(90);
  const [showAll, setShowAll] = useState(false);

  const now = Date.now();
  const points = entries.filter(e => !range || e.recordedAt >= now - range * DAY).map(e => ({ at: e.recordedAt, value: e.weight, note: '' })).reverse();
  const monthAgo = entries.find(e => e.recordedAt <= now - 30 * DAY);
  const change = latest !== null && monthAgo ? latest - monthAgo.weight : null;

  const log = () => {
    const at = when ? new Date(when).getTime() : Date.now();
    if (update(s => logBodyweight(s, weight, at))) setWhen('');
  };
  const remove = (id: string) => update(s => {
    const bodyweights = (s.bodyweights ?? []).filter(e => e.id !== id);
    const next = { ...s, bodyweights };
    return { ...next, profile: { ...s.profile, bodyweight: latestBodyweight(next) } };
  }, 'Entry deleted');

  return (
    <>
      <section className="hero">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="grow">
            <div className="stat"><div className="k">Bodyweight</div><div className="v xl">{latest !== null ? lb(latest) : '–'}<small> lb</small></div></div>
          </div>
          {change !== null && (
            <div className="stat" style={{ textAlign: 'right' }}>
              <div className="k">30 days</div>
              <div className="v">{change > 0 ? '+' : change < 0 ? '−' : ''}{lb(Math.abs(change))}<small> lb</small></div>
            </div>
          )}
        </div>
        <div className="row" style={{ marginTop: 10, gap: 6 }}>
          <NumberInput className="input" value={weight} onCommit={setWeight} label="Bodyweight in pounds" max={1500} />
          <button className="btn primary" onClick={log} disabled={!weight}><Icon name="plus" size={16} stroke={2.6} />Log bodyweight</button>
        </div>
        <label className="row tiny" style={{ marginTop: 8, gap: 6, fontWeight: 600 }}>
          <span>Measured</span>
          <input type="datetime-local" className="input" style={{ height: 34, fontSize: 13, padding: '0 10px', width: 'auto', flex: 1 }}
            value={when || dateTimeInput(now)} max={dateTimeInput(now)} onChange={e => setWhen(e.target.value)} />
        </label>
      </section>

      <section className="card hi">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 className="card-title">Trend</h2>
          <div className="seg sm" style={{ width: 200 }}>
            {RANGES.map(([d, label]) => <button key={label} aria-pressed={range === d} onClick={() => setRange(d)}>{label}</button>)}
          </div>
        </div>
        {points.length ? <LineChart points={points} label="Bodyweight over time" /> : <div className="empty small">No entries in this range.</div>}
      </section>

      {entries.length > 0 && (
        <>
          <div className="section-label">Entries</div>
          <div className="group">
            {(showAll ? entries : entries.slice(0, 6)).map(e => (
              <div key={e.id} className="list-row" style={{ minHeight: 46 }}>
                <div className="grow"><span className="t">{lb(e.weight)} lb</span> <span className="s">· {dayLabel(e.recordedAt)} {timeOfDay(e.recordedAt)}</span></div>
                <button className="icon-btn plain sm" onClick={() => remove(e.id)} aria-label={`Delete ${e.weight} lb entry`}><Icon name="trash" size={17} /></button>
              </div>
            ))}
          </div>
          {entries.length > 6 && <button className="btn sm ghost" onClick={() => setShowAll(v => !v)}>{showAll ? 'Show fewer' : `Show all ${entries.length}`}</button>}
        </>
      )}
    </>
  );
}
