import { useState } from 'react';
import type { strengthLeaderboard } from '../../shared/strength.ts';
import { isAddedWeight } from '../../shared/strength.ts';
import { equipmentKind } from '../../shared/equipment.ts';
import { useWout } from '../lib/store.tsx';
import { lb, signedLb } from '../lib/format.ts';
import { FEATURED_MAX, pickFeatured, useFeaturedLifts } from '../lib/featured.ts';
import { LiftDetails, type Ranked } from '../components/LiftRow.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { Icon } from '../components/Icon.tsx';

type Board = ReturnType<typeof strengthLeaderboard>;

const pct = (r: Ranked) => (r.percentile.label === '<5%' ? '<5' : r.percentile.label === '>95%' ? '>95' : String(Math.round(r.percentile.value)));
const isPct = (r: Ranked) => r.rankingKind !== 'tier';
const TIER_SHORT: Record<string, string> = { Beginner: 'Beg.', Novice: 'Nov.', Intermediate: 'Int.', Advanced: 'Adv.', Elite: 'Elite', 'World Class': 'WC' };
const tierShort = (level: string) => TIER_SHORT[level] ?? level.slice(0, 4);
function maxText(r: Ranked) {
  if (isAddedWeight(r.exercise)) return `${signedLb(r.estimatedMax)} lb added`;
  return `${lb(r.estimatedMax, 0)} lb${equipmentKind(r.exercise) === 'dumbbell' ? ' per hand' : ''}`;
}
const levelText = (r: Ranked) => (r.rankingKind === 'proxy' ? 'estimate from bench proxy' : r.rankingKind === 'tier' ? `${r.percentile.level} · provisional` : r.percentile.level);

/** Bento Strength: lilac top-lift card, two pastel tiles, then a compact list. */
export function BentoStrength({ board, bw, sexLabel }: { board: Board; bw: number; sexLabel: string }) {
  const { user } = useWout();
  const [chosen, setChosen] = useFeaturedLifts(user.id);
  const [detail, setDetail] = useState<Ranked | null>(null);
  const [editing, setEditing] = useState(false);
  const featured = pickFeatured(board.ranked, chosen);
  const [top, ...tiles] = featured;
  const rest = board.ranked.filter(r => !featured.includes(r));

  return (
    <>
      {top && (
        <button className="bento-top" onClick={() => setDetail(top)}>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="bento-kicker">{chosen?.length ? 'Featured' : 'Top lift'} · {sexLabel.toLowerCase()} at {lb(bw, 0)} lb</div>
            <div className="bento-top-name">{top.exercise.name}</div>
            <div className="small muted">{maxText(top)} · est. 1RM</div>
            <span className="bento-pill">{top.percentile.level}</span>
          </div>
          <Ring value={top.percentile.value} label={isPct(top) ? pct(top) : top.percentile.level.slice(0, 3)} unit={isPct(top) ? '%' : ''} />
        </button>
      )}

      {tiles.length > 0 && (
        <div className="bento-tiles-2">
          {tiles.map((r, i) => (
            <button key={r.exercise.id} className={'bento-tile ' + (i === 0 ? 'sky' : 'mint')} onClick={() => setDetail(r)}>
              <div className="bento-tile-name ellipsis">{r.exercise.name}</div>
              <div className="bento-tile-big">{isPct(r) ? <>{pct(r)}<small>%</small></> : <span style={{ fontSize: 24 }}>{r.percentile.level}</span>}</div>
              <div className={'tiny' + (r.rankingKind === 'proxy' ? ' est-text' : ' muted')}>{maxText(r)} · {r.rankingKind === 'proxy' ? 'estimate' : r.percentile.level}</div>
              <div className="bento-bar" role="img" aria-label={`${r.exercise.name} ${pct(r)} percentile`}><div style={{ width: Math.max(4, Math.min(100, r.percentile.value)) + '%' }} /></div>
            </button>
          ))}
        </div>
      )}

      <button className="btn sm ghost" style={{ alignSelf: 'flex-end', marginTop: -2 }} onClick={() => setEditing(true)}>
        <Icon name="edit" size={15} />Customize big cards
      </button>

      {rest.length > 0 && (
        <section className="bento-list">
          {rest.map(r => (
            <button key={r.exercise.id} className="bento-row" onClick={() => setDetail(r)}>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="bento-row-name ellipsis">{r.exercise.name}</div>
                <div className={'tiny' + (r.rankingKind === 'proxy' ? ' est-text' : ' muted')}>{maxText(r)} · {levelText(r)}</div>
              </div>
              <div className="bento-mini-bar" aria-hidden="true"><div className={r.rankingKind === 'percentile' ? '' : 'est'} style={{ width: Math.max(6, Math.min(100, r.percentile.value)) + '%' }} /></div>
              <div className="bento-row-pct" title={r.percentile.level}>{isPct(r) ? `${pct(r)}%` : tierShort(r.percentile.level)}</div>
            </button>
          ))}
        </section>
      )}

      {board.unranked.length > 0 && (
        <>
          <div className="section-label">Not ranked</div>
          <section className="bento-list">
            {board.unranked.map(u => (
              <div key={u.exercise.id} className="bento-row" style={{ cursor: 'default' }}>
                <div className="grow"><div className="bento-row-name">{u.exercise.name}</div><div className="tiny muted">{u.reason}</div></div>
              </div>
            ))}
          </section>
        </>
      )}

      {detail && (
        <Sheet title={detail.exercise.name} onClose={() => setDetail(null)}>
          <div className="small muted">Est. 1RM {maxText(detail)} · from {lb(detail.set.weight)} × {detail.set.reps} · {isPct(detail) ? `${pct(detail)}% · ` : ''}{detail.percentile.level}</div>
          <LiftDetails r={detail} sexLabel={sexLabel} />
        </Sheet>
      )}
      {editing && <FeaturedEditor ranked={board.ranked} chosen={chosen} onSave={setChosen} onClose={() => setEditing(false)} />}
    </>
  );
}

function Ring({ value, label, unit }: { value: number; label: string; unit: string }) {
  const r = 38, c = 2 * Math.PI * r, f = Math.max(0, Math.min(100, value)) / 100;
  return (
    <div className="bento-ring" aria-hidden="true">
      <svg width="92" height="92" viewBox="0 0 92 92">
        <circle cx="46" cy="46" r={r} fill="#ffffff" stroke="#cfc5f7" strokeWidth="9" />
        <circle cx="46" cy="46" r={r} fill="none" stroke="var(--primary)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 46 46)" />
      </svg>
      <div className="bento-ring-label">{label}<small>{unit}</small></div>
    </div>
  );
}

/** Pick up to three lifts in order: 1 = top card, 2–3 = tiles. */
function FeaturedEditor({ ranked, chosen, onSave, onClose }: { ranked: Ranked[]; chosen: string[] | null; onSave: (ids: string[] | null) => void; onClose: () => void }) {
  const [picks, setPicks] = useState<string[]>(() => (chosen?.length ? chosen : pickFeatured(ranked, null).map(r => r.exercise.id)));
  const toggle = (id: string) => setPicks(p => (p.includes(id) ? p.filter(x => x !== id) : p.length < FEATURED_MAX ? [...p, id] : p));
  return (
    <Sheet title="Big cards" onClose={onClose}>
      <div className="small muted">Tap lifts in the order you want them: 1 is the top card, 2 and 3 are the tiles. Saved on this device.</div>
      <div className="group">
        {ranked.map(r => {
          const n = picks.indexOf(r.exercise.id);
          return (
            <button key={r.exercise.id} className="list-row" onClick={() => toggle(r.exercise.id)} aria-pressed={n >= 0}
              disabled={n < 0 && picks.length >= FEATURED_MAX}>
              <span className={'pick-badge' + (n >= 0 ? ' on' : '')}>{n >= 0 ? n + 1 : ''}</span>
              <div className="grow"><div className="t ellipsis">{r.exercise.name}</div><div className="s">{maxText(r)} · {isPct(r) ? `${pct(r)}% · ` : ''}{r.percentile.level}</div></div>
            </button>
          );
        })}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn tonal" onClick={() => { onSave(null); onClose(); }}>Automatic</button>
        <button className="btn primary grow" disabled={!picks.length} onClick={() => { onSave(picks); onClose(); }}>Save</button>
      </div>
    </Sheet>
  );
}
