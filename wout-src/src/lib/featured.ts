import { useCallback, useState } from 'react';
import type { Ranked } from '../components/LiftRow.tsx';

/**
 * Which lifts fill the big Strength cards (Bento): first = top card, next two = tiles.
 * Saved per account on this device (the WorkoutState export has no room for UI settings).
 */
const key = (userId: string) => 'wout-featured-' + userId;
export const FEATURED_MAX = 3;

export function useFeaturedLifts(userId: string) {
  const [ids, setIds] = useState<string[] | null>(() => {
    try { const v = JSON.parse(localStorage.getItem(key(userId)) ?? 'null'); return Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, FEATURED_MAX) : null; } catch { return null; }
  });
  const save = useCallback((next: string[] | null) => {
    setIds(next);
    try { next ? localStorage.setItem(key(userId), JSON.stringify(next)) : localStorage.removeItem(key(userId)); } catch { /* private mode */ }
  }, [userId]);
  return [ids, save] as const;
}

/** Your picks (if ranked), else automatic: best percentile lift, then Bench and Squat, then the next best. */
export function pickFeatured(ranked: Ranked[], chosen: string[] | null): Ranked[] {
  const byId = new Map(ranked.map(r => [r.exercise.id, r]));
  if (chosen?.length) {
    const picks = chosen.map(id => byId.get(id)).filter((r): r is Ranked => !!r);
    if (picks.length) return picks.slice(0, FEATURED_MAX);
  }
  const out: Ranked[] = [];
  const add = (r: Ranked | undefined) => { if (r && !out.includes(r) && out.length < FEATURED_MAX) out.push(r); };
  add(ranked.find(r => r.rankingKind === 'percentile') ?? ranked[0]);
  add(byId.get('bench-press')); add(byId.get('squat'));
  for (const r of ranked) add(r);
  return out;
}
