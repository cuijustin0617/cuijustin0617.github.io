import { useState } from 'react';
import type { BigGroupStatus } from '../../shared/big-groups.ts';
import { sinceLabel } from '../../shared/big-groups.ts';
import { Icon } from './Icon.tsx';

/**
 * Balance suggestions: the five big groups ranked by how long since each was trained.
 * The top group is expanded with exercises to add; tap any other row to see its options.
 */
export function BigGroupsCard({ groups, onAdd }: { groups: BigGroupStatus[]; onAdd: (exerciseId: string) => void }) {
  const [cardOpen, setCardOpen] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const top = groups[0];
  const next = groups.find(g => !g.inWorkout);
  const expanded = open ?? (top && !top.inWorkout ? top.id : null);
  return (
    <section className={'suggest tonal-tertiary bg-card' + (cardOpen ? ' open' : '')} aria-label="Balance: big groups ranked by time since trained">
      <button className="bg-head" onClick={() => setCardOpen(o => !o)} aria-expanded={cardOpen}>
        <Icon name="balance" size={18} />
        <span className="bg-title">Balance</span>
        <span className="bg-summary grow">
          {cardOpen ? 'longest since trained first' : next ? <>Next: <strong>{next.name}</strong> · {sinceLabel(next.daysAgo)}</> : 'All groups in this workout'}
        </span>
        <span className="bg-chevron" aria-hidden="true"><Icon name="chevronDown" size={18} stroke={2.4} /></span>
      </button>
      {cardOpen && groups.map((g, i) => {
        const isOpen = expanded === g.id;
        return (
          <div key={g.id} className={'bg-item' + (i === 0 ? ' first' : '')}>
            <button className="bg-row" onClick={() => setOpen(isOpen ? '' : g.id)} aria-expanded={isOpen}>
              <span className="bg-rank">{i + 1}</span>
              <span className="bg-name grow">{g.name}</span>
              {g.inWorkout
                ? <span className="bg-when tiny"><Icon name="check" size={14} stroke={2.8} />In this workout</span>
                : <span className="bg-when small">{sinceLabel(g.daysAgo)}</span>}
            </button>
            {isOpen && (
              <div className="bg-options">
                <div className="tiny muted">{g.sets7d} set{g.sets7d === 1 ? '' : 's'} in the last 7 days</div>
                <div className="bg-buttons">
                  {g.options.map((o, j) => (
                    <button key={o.id} className={'btn sm ' + (j === 0 ? 'tertiary' : 'on-tertiary')} onClick={() => onAdd(o.id)}>
                      <Icon name="plus" size={14} stroke={2.8} />{o.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
