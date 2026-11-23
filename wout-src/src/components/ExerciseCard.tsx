import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LoggedExercise, SetRow } from '../../shared/workout.ts';
import { changeWeight, enterSetNumbers, uid } from '../../shared/workout.ts';
import { isAddedWeight, oneRepMax } from '../../shared/strength.ts';
import { equipmentKind } from '../../shared/equipment.ts';
import { useCatalog } from '../lib/hooks.ts';
import { useWout } from '../lib/store.tsx';
import { lb } from '../lib/format.ts';
import { Icon } from './Icon.tsx';

/** Text input for numbers that keeps a draft while typing and commits on blur / Enter. */
export function NumberInput({ value, onCommit, label, className, step = 'any', max = 3000, integer = false }: {
  value: number; onCommit: (n: number) => void; label: string; className?: string; step?: string; max?: number; integer?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft.replace(',', '.'));
    if (draft.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= max) onCommit(integer ? Math.round(n) : Math.round(n * 100) / 100);
    else if (draft.trim() === '') onCommit(0);
    setDraft(null);
  };
  return (
    <input className={className} aria-label={label} inputMode={integer ? 'numeric' : 'decimal'} type="text" step={step}
      value={draft ?? (value ? String(value) : '')} placeholder="0"
      onFocus={e => { setDraft(value ? String(value) : ''); requestAnimationFrame(() => e.target.select()); }}
      onChange={e => setDraft(e.target.value.replace(/[^\d.,]/g, ''))}
      onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
  );
}

export function Menu({ label, items }: { label: string; items: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="icon-btn sm plain" aria-label={label} aria-expanded={open} onClick={() => setOpen(o => !o)}><Icon name="more" size={20} /></button>
      {open && (
        <div role="menu" className="card hi" style={{ position: 'absolute', right: 0, top: 38, zIndex: 20, padding: 4, minWidth: 190, boxShadow: '0 12px 32px rgba(0,0,0,0.18)', borderRadius: 18 }}>
          {items.map(item => (
            <button key={item.label} role="menuitem" disabled={item.disabled} className="list-row" style={{ minHeight: 42, padding: '8px 12px', borderRadius: 12, fontSize: 14, fontWeight: 600, color: item.danger ? 'var(--error)' : undefined }}
              onClick={() => { setOpen(false); item.onClick(); }}>{item.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One logged exercise. `mode="active"`: complete toggles + rest timer.
 * `mode="history"`: editing a finished session (every set with reps counts as completed).
 */
export function ExerciseCard({ logged, mode, previous, bodyweight, onSets, onRemove, onMove, canMoveUp, canMoveDown, onComplete, footer }: {
  logged: LoggedExercise; mode: 'active' | 'history'; previous: SetRow[]; bodyweight: number | null;
  onSets: (sets: SetRow[], undoLabel?: string) => void; onRemove: () => void; onMove: (dir: -1 | 1) => void;
  canMoveUp: boolean; canMoveDown: boolean; onComplete?: () => void; footer?: ReactNode;
}) {
  const { byId } = useCatalog();
  const { toast } = useWout();
  const exercise = byId.get(logged.exerciseId);
  const [armed, setArmed] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(false);
  const added = exercise ? isAddedWeight(exercise) : false;
  const perHand = exercise ? equipmentKind(exercise) === 'dumbbell' : false;

  const best = logged.sets.filter(s => s.done && s.reps > 0).reduce<number | null>((m, s) => {
    const bw = added ? bodyweight : 0;
    if (bw === null) return m;
    const total = oneRepMax(s.weight + bw, s.reps);
    const v = total === null ? null : total - bw;
    return v !== null && (m === null || v > m) ? v : m;
  }, null);

  const patch = (id: string, numbers: Partial<Pick<SetRow, 'weight' | 'reps'>>) => onSets(logged.sets.map(s => {
    if (s.id !== id) return s;
    if (mode === 'history') return enterSetNumbers(s, numbers);
    const next = { ...s, ...numbers };
    return next.done && next.reps < 1 ? { ...next, done: false, completedAt: undefined } : next;
  }));
  const toggle = (s: SetRow) => {
    if (!s.done && s.reps < 1) return toast('Enter reps before completing the set.');
    onSets(logged.sets.map(x => x.id === s.id ? (x.done ? { ...x, done: false, completedAt: undefined } : { ...x, done: true, completedAt: Date.now() }) : x));
    if (!s.done) onComplete?.();
  };
  const remove = (id: string) => { setArmed(null); onSets(logged.sets.filter(s => s.id !== id), 'Set deleted'); };
  const addSet = () => {
    const last = logged.sets.at(-1) ?? previous.at(-1);
    const row: SetRow = { id: uid(), weight: last?.weight ?? 0, reps: last?.reps ?? 8, done: false };
    onSets([...logged.sets, mode === 'history' ? enterSetNumbers(row, {}) : row]);
  };

  const subParts = [exercise?.category ?? 'Unknown exercise', perHand ? 'lb per hand' : added ? 'added load' : null,
    best !== null ? `Est. 1RM ${added ? '+' : ''}${lb(best, 0)} lb` : null].filter(Boolean);

  return (
    <section className="ex-card" aria-label={exercise?.name}>
      <div className="ex-head">
        <div className="grow">
          <h3 className="ex-name">{exercise?.name ?? logged.exerciseId}</h3>
          <div className="ex-sub">{subParts.join(' · ')}</div>
        </div>
        <Menu label={`${exercise?.name ?? 'Exercise'} options`} items={[
          { label: 'Move up', onClick: () => onMove(-1), disabled: !canMoveUp },
          { label: 'Move down', onClick: () => onMove(1), disabled: !canMoveDown },
          ...(exercise?.loadNote ? [{ label: showNote ? 'Hide logging note' : 'Logging note', onClick: () => setShowNote(v => !v) }] : []),
          { label: 'Remove exercise', onClick: onRemove, danger: true },
        ]} />
      </div>
      {showNote && exercise?.loadNote && <div className="note">{exercise.loadNote}</div>}
      <div className="set-head" aria-hidden="true"><div>Set</div><div>Previous</div><div>{added ? '+lb' : 'lb'}</div><div>Reps</div><div /></div>
      {logged.sets.map((s, i) => {
        const p = previous[i] ?? previous.at(-1);
        const isArmed = armed === s.id;
        return (
          <div key={s.id} className={'set-row' + (s.done && mode === 'active' ? ' done' : '')}>
            <button className="set-no" onClick={() => setArmed(isArmed ? null : s.id)} aria-label={`Set ${i + 1} actions`} aria-pressed={isArmed}>{i + 1}</button>
            <button className="set-prev" style={{ textAlign: 'left' }} disabled={!p} onClick={() => p && patch(s.id, { weight: p.weight, reps: p.reps })}
              aria-label={p ? `Use previous ${p.weight} pounds for ${p.reps}` : 'No previous set'}>
              {p ? `${lb(p.weight)} × ${p.reps}` : '—'}
            </button>
            <div className="stepper">
              <button onClick={() => patch(s.id, { weight: changeWeight(s.weight, -1) })} aria-label={`Decrease set ${i + 1} weight`}><Icon name="minus" size={16} stroke={2.6} /></button>
              <NumberInput value={s.weight} onCommit={n => patch(s.id, { weight: n })} label={`Set ${i + 1} weight in pounds`} />
              <button onClick={() => patch(s.id, { weight: changeWeight(s.weight, 1) })} aria-label={`Increase set ${i + 1} weight`}><Icon name="plus" size={16} stroke={2.6} /></button>
            </div>
            <NumberInput className="reps-input" value={s.reps} integer max={999} onCommit={n => patch(s.id, { reps: n })} label={`Set ${i + 1} reps`} />
            {isArmed || mode === 'history'
              ? <button className="check del" onClick={() => remove(s.id)} aria-label={`Delete set ${i + 1}`}><Icon name="trash" size={17} /></button>
              : <button className={'check' + (s.done ? ' on' : '')} onClick={() => toggle(s)} aria-pressed={s.done} aria-label={s.done ? `Set ${i + 1} completed` : `Complete set ${i + 1}`}><Icon name="check" size={18} stroke={2.8} /></button>}
          </div>
        );
      })}
      <button className="add-set" onClick={addSet}><Icon name="plus" size={16} stroke={2.6} />Add set</button>
      {footer}
    </section>
  );
}
