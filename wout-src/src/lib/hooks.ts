import { useEffect, useMemo, useState } from 'react';
import { catalog, exerciseById } from '../../shared/catalog.ts';
import { useWout } from './store.tsx';

/** Re-render on an interval, returning the current time. */
export function useNow(intervalMs = 1000, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs, enabled]);
  return now;
}

export function useCatalog() {
  return useMemo(() => ({ catalog, byId: exerciseById, name: (id: string) => exerciseById.get(id)?.name ?? 'Unknown exercise' }), []);
}

/** Hash routing: #/workout, #/progress/strength, #/history, #/exercises, #/profile */
export function useRoute() {
  const read = () => { const h = window.location.hash.replace(/^#\/?/, ''); return (!h || h.includes('=') ? 'workout' : h).split('/'); };
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const on = () => { setParts(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parts;
}
export const go = (path: string) => { window.location.hash = '/' + path; };

export function useBodyweightLabel() {
  const { state } = useWout();
  return state.profile.sex === 'male' ? 'Men' : 'Women';
}
