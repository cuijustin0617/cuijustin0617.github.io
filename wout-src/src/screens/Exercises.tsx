import { useMemo, useState } from 'react';
import { favoriteExerciseIds, rankExercises, benchmarkFor, levels, type Exercise } from '../../shared/workout.ts';
import { accessibleExerciseIds, addAccessibleExercise, automaticAccessIds } from '../../shared/recommendations.ts';
import { bodyweightStandards, latestBodyweight } from '../../shared/strength.ts';
import { exerciseTrend, exerciseMuscles, muscleNames, type Muscle } from '../../shared/training-progress.ts';
import { equipmentKind, equipmentLabels } from '../../shared/equipment.ts';
import { useWout } from '../lib/store.tsx';
import { go, useCatalog } from '../lib/hooks.ts';
import { lb } from '../lib/format.ts';
import { Sheet } from '../components/Sheet.tsx';
import { LineChart } from '../components/LineChart.tsx';
import { Icon } from '../components/Icon.tsx';
import { ProfileButton } from './Workout.tsx';

const TABS = [['all', 'All'], ['favorites', 'Favorites'], ['recent', 'Recent'], ['frequent', 'Frequent']] as const;

export function ExercisesScreen() {
  const { state } = useWout();
  const { catalog } = useCatalog();
  const [tab, setTab] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(60);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const list = useMemo(() => rankExercises(catalog, state, query.trim() ? 'all' : tab, query), [catalog, state, tab, query]);
  const favorites = favoriteExerciseIds(state);
  const access = accessibleExerciseIds(state);
  return (
    <>
      <div className="topbar">
        <h1 className="title">Exercises</h1>
        <ProfileButton />
      </div>
      <div className="search">
        <Icon name="search" size={20} />
        <input className="input on-surface" type="search" placeholder={`Search ${catalog.length} exercises`} value={query} onChange={e => setQuery(e.target.value)} aria-label="Search exercises" />
      </div>
      {!query.trim() && (
        <div className="seg sm" role="tablist">
          {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}
        </div>
      )}
      {list.length === 0 && <div className="card empty"><strong>Nothing here yet</strong>{query ? 'Try another search.' : 'Log workouts to fill this list.'}</div>}
      <div className="group">
        {list.slice(0, limit).map(e => (
          <button key={e.id} className="list-row" onClick={() => setDetail(e)}>
            <div className="grow">
              <div className="t ellipsis">{e.name}</div>
              <div className="s">{e.bodypart} · {equipmentLabels[equipmentKind(e)]}{access.has(e.id) ? ' · available' : ''}</div>
            </div>
            {favorites.has(e.id) && <span style={{ color: 'var(--primary)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Favorite"><path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z" /></svg></span>}
            <Icon name="chevronRight" size={18} />
          </button>
        ))}
      </div>
      {list.length > limit && <button className="btn tonal" onClick={() => setLimit(l => l + 80)}>Show more ({list.length - limit})</button>}
      {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function ExerciseDetail({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const { state, update } = useWout();
  const bw = latestBodyweight(state);
  const favorites = favoriteExerciseIds(state);
  const explicitFav = state.favorites.includes(exercise.id);
  const autoAccess = automaticAccessIds(state).has(exercise.id);
  const marked = (state.accessibleExercises ?? []).includes(exercise.id);
  const trend = useMemo(() => exerciseTrend(state, exercise, 'max'), [state, exercise]);
  const standards = bw ? bodyweightStandards(exercise, state.profile.sex, bw) : null;
  const fallback = benchmarkFor(exercise, state.profile.sex, bw);
  const anchors = standards?.values ?? fallback.values;
  const labels = exercise.benchmarkTier?.labels ?? levels;
  const muscles = Object.entries(exerciseMuscles(exercise)).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));

  const toggleFav = () => update(s => ({ ...s, favorites: explicitFav ? s.favorites.filter(f => f !== exercise.id) : [...s.favorites, exercise.id] }));
  const toggleAccess = () => update(s => {
    const cur = s.accessibleExercises ?? [];
    return { ...s, accessibleExercises: marked ? cur.filter(x => x !== exercise.id) : [...cur, exercise.id] };
  });
  const add = () => { if (update(s => addAccessibleExercise(s, exercise.id))) { onClose(); go('workout'); } };

  return (
    <Sheet title={exercise.name} onClose={onClose}>
      <div className="small muted">{exercise.bodypart} · {exercise.category}{exercise.aliases.length ? ` · also “${exercise.aliases.slice(0, 2).join('”, “')}”` : ''}</div>
      <div className="row wrap" style={{ gap: 6 }}>
        <button className="btn primary" onClick={add}><Icon name="plus" size={16} stroke={2.6} />{state.active ? 'Add to workout' : 'Start with this'}</button>
        <button className={'btn ' + (favorites.has(exercise.id) ? 'tonal' : 'outline')} onClick={toggleFav} aria-pressed={explicitFav}
          disabled={!explicitFav && favorites.has(exercise.id)} title={!explicitFav && favorites.has(exercise.id) ? 'Automatically a favorite because you have logged it' : undefined}>
          {favorites.has(exercise.id) ? 'Favorited' : 'Favorite'}
        </button>
        <button className={'btn ' + (marked || autoAccess ? 'tonal' : 'outline')} onClick={toggleAccess} aria-pressed={marked} disabled={autoAccess && !marked}>
          {marked || autoAccess ? 'I can do this' : 'Mark available'}
        </button>
      </div>
      {exercise.loadNote && <div className="note">{exercise.loadNote}</div>}
      {muscles.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ fontSize: 15 }}>Muscles credited</div>
          <div className="small muted">{muscles.map(([m, c]) => `${muscleNames[m as Muscle]}${c === 1 ? '' : ' (½)'}`).join(' · ')}</div>
        </div>
      )}
      {anchors && (
        <div className="card">
          <div className="card-title" style={{ fontSize: 15 }}>Standards</div>
          <div className="small muted">{standards ? `${state.profile.sex === 'male' ? 'Men' : 'Women'} at ${lb(bw, 0)} lb${standards.clamped ? ' (nearest table row)' : ''}` : fallback.label} · est. 1RM in lb</div>
          <div className="anchors">
            {anchors.map((v, i) => <div key={i} className="anchor"><div className="v">{lb(v, 0)}</div><div className="k">{labels[i] === 'Intermediate' ? 'Intermed.' : labels[i]}</div></div>)}
          </div>
          {exercise.benchmarkProxy && <div className="tiny muted" style={{ marginTop: 6 }}>Estimate: {exercise.benchmarkProxy.note}</div>}
        </div>
      )}
      <div className="card hi">
        <div className="card-title" style={{ fontSize: 15 }}>Estimated 1RM by day</div>
        {trend.length ? <LineChart points={trend} label={`${exercise.name} estimated 1RM history`} /> : <div className="empty small" style={{ padding: 10 }}>Not logged yet.</div>}
      </div>
    </Sheet>
  );
}
