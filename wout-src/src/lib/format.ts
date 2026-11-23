const DAY = 86_400_000;

/** Loads are pounds. Keep half-plates, trim trailing zeros. */
export function lb(n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–';
  const rounded = Math.round(n * 10 ** digits) / 10 ** digits;
  return rounded.toLocaleString('en-US', { maximumFractionDigits: digits });
}
export const whole = (n: number) => Math.round(n).toLocaleString('en-US');
export const signedLb = (n: number) => (n >= 0 ? '+' : '−') + lb(Math.abs(n), 0);

export function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

const startOfDay = (at: number) => { const d = new Date(at); d.setHours(0, 0, 0, 0); return d.getTime(); };
export function dayLabel(at: number, now = Date.now()) {
  const diff = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear();
  return new Date(at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}
export const shortDate = (at: number) => new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const timeOfDay = (at: number) => new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
export const monthLabel = (at: number) => new Date(at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export function ago(at: number, now = Date.now()) {
  const hours = Math.max(0, (now - at) / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 48) return `${Math.floor(hours)}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ordinal(n: number) {
  const v = Math.round(n), s = ['th', 'st', 'nd', 'rd'], m = v % 100;
  return v + (s[(m - 20) % 10] || s[m] || s[0]);
}

/** datetime-local value for an epoch ms. */
export function dateTimeInput(at: number) {
  const d = new Date(at), p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
