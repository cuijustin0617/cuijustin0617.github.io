import type { TrendPoint } from '../../shared/training-progress.ts';
import { lb, shortDate } from '../lib/format.ts';

const W = 340, H = 150, L = 34, R = 10, T = 10, B = 22;

/** Measured history (solid), dated targets (diamonds), and a dashed projection. */
export function LineChart({ points, targets = [], projection = [], unit = 'lb', label }: {
  points: TrendPoint[]; targets?: TrendPoint[]; projection?: TrendPoint[]; unit?: string; label: string;
}) {
  const all = [...points, ...targets, ...projection];
  if (!all.length) return <div className="empty small">No data yet.</div>;
  let x0 = Math.min(...all.map(p => p.at)), x1 = Math.max(...all.map(p => p.at));
  if (x1 - x0 < 86_400_000 * 7) { x0 -= 86_400_000 * 3; x1 += 86_400_000 * 3; }
  let y0 = Math.min(...all.map(p => p.value)), y1 = Math.max(...all.map(p => p.value));
  const pad = Math.max((y1 - y0) * 0.15, 2.5);
  y0 = Math.max(0, y0 - pad); y1 += pad;
  const x = (at: number) => L + ((at - x0) / (x1 - x0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const line = (pts: TrendPoint[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.at).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const grid = [0, 0.5, 1].map(f => y0 + (y1 - y0) * f);
  const last = points.at(-1);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {grid.map(v => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--outline-2)" strokeWidth="1" strokeDasharray={v === grid[0] ? undefined : '2 4'} />
          <text x={L - 6} y={y(v) + 3} textAnchor="end">{lb(v, 0)}</text>
        </g>
      ))}
      <text x={L} y={H - 6}>{shortDate(x0)}</text>
      <text x={W - R} y={H - 6} textAnchor="end">{shortDate(x1)}</text>
      {projection.length > 1 && <path d={line(projection)} fill="none" stroke="var(--primary)" strokeOpacity="0.7" strokeWidth="2" strokeDasharray="5 5" />}
      {points.length > 1 && <path d={line(points)} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {points.length <= 60 && points.map(p => <circle key={p.at} cx={x(p.at)} cy={y(p.value)} r="3" fill="var(--primary)"><title>{`${shortDate(p.at)} · ${lb(p.value)} ${unit}${p.note ? ' · ' + p.note : ''}`}</title></circle>)}
      {last && <circle cx={x(last.at)} cy={y(last.value)} r="5" fill="var(--surface-hi)" stroke="var(--primary)" strokeWidth="3" />}
      {targets.map(t => (
        <g key={t.at + '-' + t.value}>
          <path d={`M${x(t.at)} ${y(t.value) - 6} l6 6 -6 6 -6 -6z`} fill="var(--tertiary)" />
          <title>{`Target ${shortDate(t.at)} · ${lb(t.value)} ${unit}${t.note ? ' · ' + t.note : ''}`}</title>
        </g>
      ))}
    </svg>
  );
}
