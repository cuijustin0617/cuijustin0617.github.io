import { useState } from 'react';
import type { BigGroupStatus } from '../../shared/big-groups.ts';
import { sinceLabel } from '../../shared/big-groups.ts';
import { Icon } from './Icon.tsx';

/**
 * Balance suggestions: the five big groups ranked by how long since each was trained.
 * The top group is expanded with exercises to add; tap any other row to see its options.
 */
export function BigGroupsCard({ groups, onAdd }: { groups: BigGroupStatus[]; onAdd: (exerciseId: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const top = groups[0];
  const expanded = open ?? (top && !top.inWorkout ? top.id : null);
  return (
    <section className="suggest tonal-tertiary" aria-label="Balance: big groups ranked by time since trained">
      <div className="row" style={{ marginBottom: 4 }}>
        <Icon name="balance" size={18} />
        <div className="grow" style={{ fontWeight: 800, fontSize: 15 }}>Balance</div>
        <span className="tiny muted">longest since trained first</span>
      </div>
      {groups.map((g, i) => {
        const isOpen = expanded === g.id;
        return (
          <div key={g.id} className="suggest-group" style={{ marginTop: i ? 0 : 4, paddingTop: i ? 6 : 6 }}>
            <button className="row" style={{ width: '100%', textAlign: 'left', minHeight: 32 }} onClick={() => setOpen(isOpen ? '' : g.id)} aria-expanded={isOpen}>
              <span style={{ width: 18, fontWeight: 800, opacity: 0.7 }}>{i + 1}</span>
              <span className="grow" style={{ fontWeight: i === 0 ? 800 : 700, fontSize: i === 0 ? 16 : 14 }}>{g.name}</span>
              {g.inWorkout
                ? <span className="tiny" style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="check" size={14} stroke={2.8} />In this workout</span>
                : <span className="small" style={{ fontWeight: i === 0 ? 800 : 600 }}>{sinceLabel(g.daysAgo)}</span>}
            </button>
            {isOpen && (
              <div style={{ paddingLeft: 26, marginTop: 4 }}>
                <div className="tiny muted">{g.sets7d} set{g.sets7d === 1 ? '' : 's'} in the last 7 days</div>
                <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
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
