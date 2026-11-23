import { useWout } from '../lib/store.tsx';
import { useNow } from '../lib/hooks.ts';
import { clock } from '../lib/format.ts';
import { Icon } from './Icon.tsx';

const tabs = [
  { id: 'workout', label: 'Workout', icon: 'workout' },
  { id: 'progress', label: 'Progress', icon: 'progress' },
  { id: 'history', label: 'History', icon: 'history' },
] as const;

/** Glass bubble navigation + floating rest timer + context action button. */
export function Dock({ route, fab }: { route: string; fab: { label: string; icon: 'plus' | 'search'; onClick: () => void } }) {
  const { rest, adjustRest, stopRest } = useWout();
  const now = useNow(250, !!rest);
  const left = rest ? Math.max(0, rest.endsAt - now) : 0;
  const fraction = rest ? Math.min(1, left / (rest.duration * 1000)) : 0;
  const C = 2 * Math.PI * 13;
  return (
    <div className="dock">
      {rest && (
        <div className="rest-strip glass" role="timer" aria-live="off" aria-label={`Rest timer ${clock(left)} remaining`}>
          <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" r="13" fill="none" stroke="var(--track)" strokeWidth="4" />
            <circle cx="16" cy="16" r="13" fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${C * fraction} ${C}`} transform="rotate(-90 16 16)" />
          </svg>
          <div className="grow"><span className="small muted" style={{ fontWeight: 700 }}>Rest</span> <span className="time">{clock(left)}</span></div>
          <button className="btn sm tonal" onClick={() => adjustRest(-15)} aria-label="Subtract 15 seconds">−15</button>
          <button className="btn sm tonal" onClick={() => adjustRest(30)} aria-label="Add 30 seconds">+30</button>
          <button className="btn sm ghost" onClick={stopRest}>Skip</button>
        </div>
      )}
      <nav className="nav-row" aria-label="Primary">
        <div className="bubble glass">
          {tabs.map(t => (
            <a key={t.id} href={`#/${t.id}`} aria-current={route === t.id ? 'page' : undefined}>
              <Icon name={t.icon} size={22} stroke={route === t.id ? 2.3 : 2} />
              {t.label}
            </a>
          ))}
        </div>
        <button className="fab glass" onClick={fab.onClick} aria-label={fab.label}>
          <Icon name={fab.icon} size={26} stroke={2.4} />
        </button>
      </nav>
    </div>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useWout();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className="toast">
          <span className="grow">{t.message}</span>
          {t.action && <button onClick={() => { t.action!.run(); dismissToast(t.id); }}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  );
}
