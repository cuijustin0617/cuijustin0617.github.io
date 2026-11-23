import { useMemo, useState } from 'react';
import { rankExercises, favoriteExerciseIds } from '../../shared/workout.ts';
import { useWout } from '../lib/store.tsx';
import { useCatalog } from '../lib/hooks.ts';
import { Sheet } from './Sheet.tsx';
import { Icon } from './Icon.tsx';

const TABS = [['favorites', 'Favorites'], ['recent', 'Recent'], ['frequent', 'Frequent'], ['all', 'All']] as const;

export function ExercisePicker({ title = 'Add exercise', onPick, onClose, exclude = [] }: {
  title?: string; onPick: (id: string) => void; onClose: () => void; exclude?: string[];
}) {
  const { state, update } = useWout();
  const { catalog } = useCatalog();
  const [tab, setTab] = useState<string>(state.history.length ? 'favorites' : 'all');
  const [query, setQuery] = useState('');
  const effectiveTab = query.trim() ? 'all' : tab;
  const list = useMemo(() => rankExercises(catalog, state, effectiveTab, query).filter(e => !exclude.includes(e.id)), [catalog, state, effectiveTab, query, exclude]);
  const favorites = favoriteExerciseIds(state);
  const toggleFavorite = (id: string) => update(s => ({ ...s, favorites: s.favorites.includes(id) ? s.favorites.filter(f => f !== id) : [...s.favorites, id] }));
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="search">
        <Icon name="search" size={20} />
        <input className="input on-surface" type="search" placeholder="Search name, muscle, equipment" value={query} onChange={e => setQuery(e.target.value)} autoFocus aria-label="Search exercises" />
      </div>
      {!query.trim() && (
        <div className="seg sm" role="tablist">
          {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}
        </div>
      )}
      {list.length === 0 ? (
        <div className="empty"><strong>No matches</strong>{tab === 'recent' || tab === 'frequent' ? 'Log a workout to fill this list.' : 'Try another search.'}</div>
      ) : (
        <div className="group">
          {list.slice(0, 80).map(e => (
            <div key={e.id} className="row" style={{ paddingRight: 6 }}>
              <button className="list-row grow" onClick={() => onPick(e.id)}>
                <div className="grow">
                  <div className="t ellipsis">{e.name}</div>
                  <div className="s">{e.bodypart} · {e.category}</div>
                </div>
              </button>
              <button className="icon-btn plain sm" onClick={() => toggleFavorite(e.id)} aria-pressed={favorites.has(e.id)}
                aria-label={(favorites.has(e.id) ? 'Unfavorite ' : 'Favorite ') + e.name} style={{ color: favorites.has(e.id) ? 'var(--primary)' : undefined }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill={favorites.has(e.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z" /></svg>
              </button>
            </div>
          ))}
          {list.length > 80 && <div className="list-row s">Showing 80 of {list.length}. Search to narrow.</div>}
        </div>
      )}
    </Sheet>
  );
}
