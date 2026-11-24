import { useState } from 'react';
import type { strengthLeaderboard } from '../../shared/strength.ts';
import { levels } from '../../shared/workout.ts';
import { isAddedWeight } from '../../shared/strength.ts';
import { equipmentKind } from '../../shared/equipment.ts';
import { lb, shortDate, signedLb } from '../lib/format.ts';

export type Ranked = ReturnType<typeof strengthLeaderboard>['ranked'][number];

const PCT_TICKS = [5, 20, 50, 80, 95];
const short = (label: string) => (label === 'Intermediate' ? 'Intermed.' : label === 'World Class' ? 'World cl.' : label);

/** Compact strength row with the tier track (5 anchors) and expandable source detail. */
export function LiftRow({ r, sexLabel }: { r: Ranked; sexLabel: string }) {
  const [open, setOpen] = useState(false);
  const { exercise, percentile: p, rankingKind } = r;
  const tier = rankingKind === 'tier';
  const estimate = rankingKind === 'proxy';
  const added = isAddedWeight(exercise);
  const perHand = equipmentKind(exercise) === 'dumbbell';
  const fill = Math.max(0, Math.min(100, p.value));
  const labels = tier ? exercise.benchmarkTier!.labels : levels;
  const ticks = tier ? [0, 25, 50, 75, 100] : PCT_TICKS;
  const levelIndex = labels.indexOf(p.level);
  const maxText = added ? `${signedLb(r.estimatedMax)} lb added` : `${lb(r.estimatedMax, 0)} lb${perHand ? ' per hand' : ''}`;
  const pctText = tier ? null : p.label === '<5%' ? '<5' : p.label === '>95%' ? '>95' : String(Math.round(p.value));
  return (
    <div className="lift">
      <button className="lift-top" style={{ width: '100%', textAlign: 'left' }} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <div style={{ minWidth: 0 }}>
          <div className="lift-name">{exercise.name}</div>
          <div className="lift-sub">Est. 1RM {maxText} · from {lb(r.set.weight)} × {r.set.reps}</div>
        </div>
        <div className="lift-pct">
          {pctText !== null
            ? <div className="p">{pctText}<small>%</small></div>
            : <div className="p" style={{ fontSize: 15 }}>{p.level}</div>}
          <div className={'l' + (estimate || tier ? ' est' : '')}>{tier ? 'Provisional' : estimate ? `${p.level} · est.` : p.level}</div>
        </div>
      </button>
      <div className="track" role="img" aria-label={`${exercise.name}: ${tier ? p.level + ' tier' : `${pctText} percentile, ${p.level}`}`}>
        <div className={'fill' + (estimate || tier ? ' est' : '')} style={{ width: fill + '%' }} />
        {ticks.map(t => <div key={t} className="tick" style={{ left: t + '%' }} />)}
        <div className={'knob' + (estimate || tier ? ' est' : '')} style={{ left: fill + '%' }} />
      </div>
      {open && <LiftDetails r={r} sexLabel={sexLabel} />}
    </div>
  );
}

/** Anchors (5 tiers, current highlighted) and source / estimate notes for one ranked lift. */
export function LiftDetails({ r, sexLabel }: { r: Ranked; sexLabel: string }) {
  const { exercise, percentile: p, rankingKind } = r;
  const tier = rankingKind === 'tier';
  const estimate = rankingKind === 'proxy';
  const added = isAddedWeight(exercise);
  const perHand = equipmentKind(exercise) === 'dumbbell';
  const labels = tier ? exercise.benchmarkTier!.labels : levels;
  const levelIndex = labels.indexOf(p.level);
  return (
    <>
          <div className="anchors">
            {r.standards.map((v, i) => (
              <div key={i} className={'anchor' + (i === levelIndex ? ' on' : '')}>
                <div className="v">{added && v > 0 ? '+' : ''}{lb(v, 0)}</div>
                <div className="k">{short(labels[i])}</div>
              </div>
            ))}
          </div>
          <div className="lift-notes">
            <div>
              {tier ? 'Tier' : '1RM'} anchors in lb{perHand ? ' per hand' : ''}{added ? ' of added load' : ''} for {sexLabel.toLowerCase()} at {lb(r.referenceBodyweight, 0)} lb bodyweight.
              {r.clamped && ' Your bodyweight is outside the published table, so the nearest row is used.'}
              {added && r.trainingBodyweight !== null && ` Estimated from ${lb(r.set.weight)} lb added + ${lb(r.trainingBodyweight, 0)} lb bodyweight on ${shortDate(r.at)}.`}
              {!added && ` Best set logged ${shortDate(r.at)}.`}
            </div>
            {exercise.benchmarkProxy?.note && <div>{exercise.benchmarkProxy.note}</div>}
            {exercise.benchmarkTier?.note && <div>{exercise.benchmarkTier.note} Source: {exercise.benchmarkTier.sourceName}.</div>}
            {exercise.loadNote && <div>{exercise.loadNote}</div>}
            {!tier && !estimate && <div>Community data{exercise.benchmarkEvidence ? ` (${exercise.benchmarkEvidence.communityLifts.toLocaleString()} lifts)` : ''} from {exercise.source ? <a href={exercise.source} target="_blank" rel="noreferrer">Strength Level</a> : 'Strength Level'}. No age adjustment; machines vary by setup.</div>}
          </div>
    </>
  );
}
