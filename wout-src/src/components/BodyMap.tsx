import { memo } from 'react';
import paths from '../../data/musclemap-paths.json';
import type { Muscle } from '../../shared/training-progress.ts';

// Geometry: MuscleMap by Melih Colpan (MIT) — see data/MUSCLEMAP-LICENSE.md.
type Side = { vb: string; p: Record<string, string[]> };
const maps = paths as unknown as Record<'male' | 'female', { front: Side; back: Side }>;
const BODY = new Set(['head', 'hair', 'neck', 'hands', 'knees', 'ankles', 'feet']);
const VIEWBOX = { male: '0 95 1445 1280', female: '0 0 1473 1450' };

export const heatLevel = (sets: number, scale: [number, number]) => (sets <= 0 ? 0 : sets < scale[0] ? 1 : sets < scale[1] ? 2 : 3);

export const BodyMap = memo(function BodyMap({ sex, sets, due, scale, label }: {
  sex: 'male' | 'female'; sets: Partial<Record<Muscle, number>>; due: Set<string>; scale: [number, number]; label: string;
}) {
  const map = maps[sex];
  const fill = (muscle: string) => {
    if (BODY.has(muscle)) return 'var(--body)';
    if (due.has(muscle)) return 'var(--heat-due)';
    return `var(--heat-${heatLevel(sets[muscle as Muscle] ?? 0, scale)})`;
  };
  return (
    <svg className="body-map" viewBox={VIEWBOX[sex]} role="img" aria-label={label}>
      {(['front', 'back'] as const).map(side => Object.entries(map[side].p).map(([muscle, list]) => list.map((d, i) => (
        <path key={`${side}-${muscle}-${i}`} d={d} fill={fill(muscle)} stroke="var(--bg)" strokeWidth="3" strokeLinejoin="round" />
      ))))}
    </svg>
  );
});
