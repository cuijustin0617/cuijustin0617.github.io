import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { validateState, type WorkoutState } from '../../shared/workout.ts';
import { readPending, type AccountUser } from '../../shared/sync.ts';
import { api, ApiError } from './api.ts';

export type SyncStatus = 'saved' | 'saving' | 'pending' | 'offline' | 'conflict' | 'error';
export type Toast = { id: number; message: string; action?: { label: string; run: () => void } };
type Rest = { endsAt: number; duration: number } | null;

type Ctx = {
  user: AccountUser;
  state: WorkoutState;
  revision: number;
  sync: SyncStatus;
  syncMessage: string;
  lastSaved: number | null;
  /** Apply a pure state transition. Throws are surfaced as toasts. Returns false when rejected. */
  update: (fn: (s: WorkoutState) => WorkoutState, undoLabel?: string) => boolean;
  resolveConflict: (keep: 'cloud' | 'device') => Promise<void>;
  signOut: () => Promise<void>;
  toast: (message: string, action?: Toast['action']) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  rest: Rest;
  restDefault: number;
  setRestDefault: (seconds: number) => void;
  startRest: (seconds?: number) => void;
  adjustRest: (seconds: number) => void;
  stopRest: () => void;
};

const WoutContext = createContext<Ctx | null>(null);
export const useWout = () => {
  const ctx = useContext(WoutContext);
  if (!ctx) throw new Error('useWout outside provider');
  return ctx;
};

const pendingKey = (userId: string) => 'set-pending-' + userId;
const storage = {
  get(key: string) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* private mode */ } },
  remove(key: string) { try { localStorage.removeItem(key); } catch { /* ignore */ } },
};

export function WoutProvider({ user, initial, children, onSignedOut }: {
  user: AccountUser;
  initial: { state: WorkoutState; revision: number; conflict?: { state: WorkoutState; revision: number }; fromDevice?: boolean };
  children: ReactNode;
  onSignedOut: () => void;
}) {
  const [state, setState] = useState(initial.state);
  const [revision, setRevision] = useState(initial.revision);
  const [sync, setSync] = useState<SyncStatus>(initial.conflict ? 'conflict' : 'saved');
  const [syncMessage, setSyncMessage] = useState(initial.conflict ? 'Workouts changed on another device.' : '');
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Refs mirror state so async save loops always see the latest values.
  const stateRef = useRef(state), revisionRef = useRef(revision);
  const dirty = useRef(false), inflight = useRef(false), timer = useRef<number | undefined>(undefined);
  const remote = useRef(initial.conflict ?? null);
  const syncRef = useRef<SyncStatus>(sync);
  // Keep the ref and React state in lockstep so async loops never read a stale status.
  const status = useCallback((next: SyncStatus) => { syncRef.current = next; setSync(next); }, []);

  const toast = useCallback((message: string, action?: Toast['action']) => {
    const id = Date.now() + Math.random();
    setToasts(list => [...list.slice(-2), { id, message, action }]);
    window.setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), action ? 6000 : 3500);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts(list => list.filter(t => t.id !== id)), []);

  const persistLocal = () => storage.set(pendingKey(user.id), JSON.stringify({ state: stateRef.current, revision: revisionRef.current }));

  const save = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (inflight.current || syncRef.current === 'conflict') return;
    if (!dirty.current) return;
    inflight.current = true;
    dirty.current = false;
    const sent = stateRef.current;
    status('saving');
    try {
      const res = await api.saveState(sent, revisionRef.current, user.id);
      if (res.conflict) {
        const latest = await api.loadState();
        remote.current = { state: latest.state, revision: latest.revision };
        dirty.current = true;
        status('conflict');
        setSyncMessage('Workouts changed on another device.');
      } else {
        revisionRef.current = res.revision;
        setRevision(res.revision);
        setLastSaved(Date.now());
        if (stateRef.current === sent) { storage.remove(pendingKey(user.id)); status('saved'); setSyncMessage(''); }
        else { persistLocal(); dirty.current = true; }
      }
    } catch (e) {
      dirty.current = true;
      if (e instanceof ApiError && e.status === 401) { onSignedOut(); return; }
      const offline = e instanceof ApiError && e.status === 0;
      status(offline ? 'offline' : 'error');
      setSyncMessage(offline ? 'Offline · changes are kept on this device.' : (e as Error).message);
      timer.current = window.setTimeout(() => void save(), 8000);
    } finally {
      inflight.current = false;
      const current = syncRef.current as SyncStatus;
      if (dirty.current && current !== 'conflict' && current !== 'offline' && current !== 'error') {
        timer.current = window.setTimeout(() => void save(), 400);
      }
    }
  }, [user.id, onSignedOut]);

  const commit = useCallback((next: WorkoutState) => {
    stateRef.current = next;
    setState(next);
    dirty.current = true;
    persistLocal();
    if (syncRef.current !== 'conflict') {
      if (syncRef.current !== 'offline' && syncRef.current !== 'error') status('pending');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void save(), 600);
    }
  }, [save]);

  const update = useCallback((fn: (s: WorkoutState) => WorkoutState, undoLabel?: string) => {
    const before = stateRef.current;
    let next: WorkoutState;
    try { next = fn(before); } catch (e) { toast((e as Error).message); return false; }
    if (next === before) return true;
    if (!validateState(next)) { toast('That change would make your log invalid.'); return false; }
    commit(next);
    if (undoLabel) toast(undoLabel, { label: 'Undo', run: () => commit(before) });
    return true;
  }, [commit, toast]);

  // Retry when the network returns or the tab regains focus; refresh from cloud when idle.
  useEffect(() => {
    const retry = () => { if (dirty.current && syncRef.current !== 'conflict') { status('pending'); void save(); } };
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      if (dirty.current || inflight.current) return retry();
      const startRevision = revisionRef.current;
      try {
        const latest = await api.loadState();
        if (!dirty.current && !inflight.current && revisionRef.current === startRevision && latest.revision !== startRevision) {
          stateRef.current = latest.state; revisionRef.current = latest.revision;
          setState(latest.state); setRevision(latest.revision);
        }
      } catch (e) { if (e instanceof ApiError && e.status === 401) onSignedOut(); }
    };
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('online', retry); document.removeEventListener('visibilitychange', refresh); };
  }, [save, onSignedOut]);

  useEffect(() => {
    if (initial.conflict) dirty.current = true;
    if (initial.fromDevice) { dirty.current = true; status('pending'); void save(); }
    const flush = () => { if (dirty.current) persistLocal(); };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveConflict = useCallback(async (keep: 'cloud' | 'device') => {
    let latest = remote.current;
    try { const l = await api.loadState(); latest = { state: l.state, revision: l.revision }; } catch { /* use what we have */ }
    if (!latest) return;
    revisionRef.current = latest.revision;
    setRevision(latest.revision);
    remote.current = null;
        if (keep === 'cloud') {
      stateRef.current = latest.state;
      setState(latest.state);
      dirty.current = false;
      storage.remove(pendingKey(user.id));
      status('saved'); setSyncMessage('');
    } else {
      dirty.current = true;
      status('pending'); setSyncMessage('');
      await save();
    }
  }, [save, user.id]);

  const signOut = useCallback(async () => {
    if (dirty.current) {
      if (!window.confirm('Some changes have not synced yet. Sign out anyway? They stay on this device until you sign in again.')) return;
    }
    try { await api.logout(); } catch { /* ignore */ }
    onSignedOut();
  }, [onSignedOut]);

  // ---- Rest timer (device-local UI state; not part of the exported WorkoutState) ----
  const [rest, setRest] = useState<Rest>(() => {
    try { const r = JSON.parse(storage.get('wout-rest') ?? 'null'); return r && r.endsAt > Date.now() ? r : null; } catch { return null; }
  });
  const [restDefault, setRestDefaultState] = useState(() => Number(storage.get('wout-rest-default')) || 120);
  const saveRest = (r: Rest) => { setRest(r); r ? storage.set('wout-rest', JSON.stringify(r)) : storage.remove('wout-rest'); };
  const startRest = useCallback((seconds?: number) => {
    const s = seconds ?? restDefault;
    saveRest({ endsAt: Date.now() + s * 1000, duration: s });
  }, [restDefault]);
  const adjustRest = useCallback((seconds: number) => setRest(r => {
    if (!r) return r;
    const next = { endsAt: r.endsAt + seconds * 1000, duration: r.duration + seconds };
    storage.set('wout-rest', JSON.stringify(next));
    return next;
  }), []);
  const stopRest = useCallback(() => saveRest(null), []);
  const setRestDefault = useCallback((s: number) => { setRestDefaultState(s); storage.set('wout-rest-default', String(s)); }, []);

  useEffect(() => {
    if (!rest) return;
    const left = rest.endsAt - Date.now();
    const t = window.setTimeout(() => {
      saveRest(null);
      try { navigator.vibrate?.([180, 80, 180]); } catch { /* unsupported */ }
      toast('Rest complete');
    }, Math.max(0, left));
    return () => window.clearTimeout(t);
  }, [rest, toast]);

  const value = useMemo<Ctx>(() => ({
    user, state, revision, sync, syncMessage, lastSaved, update, resolveConflict, signOut, toast, toasts, dismissToast,
    rest, restDefault, setRestDefault, startRest, adjustRest, stopRest,
  }), [user, state, revision, sync, syncMessage, lastSaved, update, resolveConflict, signOut, toast, toasts, dismissToast, rest, restDefault, setRestDefault, startRest, adjustRest, stopRest]);

  return <WoutContext.Provider value={value}>{children}</WoutContext.Provider>;
}

/** Combine the server copy with any unsynced edits saved on this device. */
export function reconcileInitial(userId: string, server: { state: WorkoutState; revision: number }) {
  let pending: { state: WorkoutState; revision: number } | null = null;
  try { pending = readPending(localStorage, userId); } catch { pending = null; }
  if (!pending) return server;
  if (pending.revision === server.revision) return { ...pending, fromDevice: true };
  return { state: pending.state, revision: pending.revision, conflict: server };
}
