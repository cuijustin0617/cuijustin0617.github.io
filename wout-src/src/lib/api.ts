import { createClient, type SupabaseClient, type User as SupabaseUser } from '@supabase/supabase-js';
import { emptyState, validateState, type WorkoutState } from '../../shared/workout.ts';
import type { AccountUser } from '../../shared/sync.ts';

export class ApiError extends Error {
  constructor(message: string, public status: number, public body: any = null) { super(message); }
}

export type StateResponse = { state: WorkoutState; revision: number; user: AccountUser };
export type SaveResponse = { revision: number; conflict: boolean };
export type SignUpResult = { user: AccountUser | null; needsConfirmation: boolean };

/**
 * Runtime config from config.min.js (not bundled, so a static deployment can be pointed at a
 * backend without rebuilding). backend: "supabase" | "server" | "auto" (Supabase if keys exist).
 */
type Config = { backend?: 'supabase' | 'server' | 'auto'; supabaseUrl?: string; supabaseAnonKey?: string };
const config: Config = (window as any).WOUT_CONFIG ?? {};
const hasKeys = !!(config.supabaseUrl && config.supabaseAnonKey);
const kind: 'supabase' | 'server' = config.backend === 'supabase' || (config.backend !== 'server' && hasKeys) ? 'supabase' : 'server';

// Read the auth redirect fragment before the Supabase client consumes it.
const initialHash = window.location.hash;
const hashParams = new URLSearchParams(initialHash.replace(/^#\/?/, ''));
const urlError = hashParams.get('error_description')?.replace(/\+/g, ' ') ?? null;
let recoveryMode = hashParams.get('type') === 'recovery';

// ---------------------------------------------------------------- Node server (self-hosted)
async function request<T>(method: string, path: string, body?: unknown): Promise<T & { status: number }> {
  let res: Response;
  try {
    res = await fetch(path, {
      method, credentials: 'same-origin',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('You appear to be offline.', 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok && res.status !== 409) throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status, data);
  return { ...data, status: res.status };
}

const server = {
  async login(email: string, password: string) { return (await request<{ user: AccountUser }>('POST', '/api/auth/login', { email, password })).user; },
  async signup(name: string, email: string, password: string): Promise<SignUpResult> {
    return { user: (await request<{ user: AccountUser }>('POST', '/api/auth/signup', { name, email, password })).user, needsConfirmation: false };
  },
  async logout() { await request('POST', '/api/auth/logout', {}); },
  async loadState(): Promise<StateResponse> { return request<StateResponse>('GET', '/api/state'); },
  async saveState(state: WorkoutState, revision: number, expectedUserId: string): Promise<SaveResponse> {
    return request<SaveResponse>('PUT', '/api/state', { state, revision, expectedUserId });
  },
};

// ---------------------------------------------------------------- Supabase (GitHub Pages)
let sb: SupabaseClient | null = null;
if (kind === 'supabase' && hasKeys) {
  sb = createClient(config.supabaseUrl!, config.supabaseAnonKey!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
  });
  sb.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') recoveryMode = true; });
}

const toUser = (u: SupabaseUser): AccountUser => ({
  id: u.id,
  email: u.email ?? '',
  name: (u.user_metadata?.name as string | undefined)?.trim() || (u.email ?? 'You').split('@')[0],
});

/** Normalize Supabase/PostgREST/network errors to ApiError with an HTTP-like status. */
function fail(error: any, fallback: string): never {
  const message: string = error?.message ?? fallback;
  const status: number = typeof error?.status === 'number' ? error.status : 0;
  if (status === 0 && /fetch|network|load failed/i.test(message)) throw new ApiError('You appear to be offline.', 0);
  if (error?.code === 'PGRST301' || error?.code === '28000' || /jwt/i.test(message)) throw new ApiError('Your session expired. Sign in again.', 401);
  if (/invalid login credentials/i.test(message)) throw new ApiError('Email or password is incorrect.', 401);
  if (/email not confirmed/i.test(message)) throw new ApiError('Confirm your email first — check your inbox for the link.', 401);
  if (/already registered/i.test(message)) throw new ApiError('An account with this email already exists. Sign in instead.', 409);
  throw new ApiError(message || fallback, status || 500);
}

const appUrl = () => window.location.origin + window.location.pathname;

const supa = {
  client: () => { if (!sb) throw new ApiError('Wout is not connected to Supabase yet.', 503); return sb; },
  async session() {
    const { data, error } = await supa.client().auth.getSession();
    if (error) fail(error, 'Could not check your session.');
    return data.session;
  },
  async login(email: string, password: string) {
    const { data, error } = await supa.client().auth.signInWithPassword({ email: email.trim(), password });
    if (error) fail(error, 'Could not sign in.');
    return toUser(data.user);
  },
  async signup(name: string, email: string, password: string): Promise<SignUpResult> {
    const { data, error } = await supa.client().auth.signUp({
      email: email.trim(), password, options: { data: { name: name.trim() }, emailRedirectTo: appUrl() },
    });
    if (error) fail(error, 'Could not create the account.');
    // Supabase hides existing emails behind a fake user with no identities.
    if (data.user && data.user.identities?.length === 0) throw new ApiError('An account with this email already exists. Sign in instead.', 409);
    return { user: data.session && data.user ? toUser(data.user) : null, needsConfirmation: !data.session };
  },
  async logout() { await supa.client().auth.signOut({ scope: 'local' }); },
  async resetPassword(email: string) {
    const { error } = await supa.client().auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() });
    if (error) fail(error, 'Could not send the reset email.');
  },
  async updatePassword(password: string) {
    const { error } = await supa.client().auth.updateUser({ password });
    if (error) fail(error, 'Could not update the password.');
    recoveryMode = false;
  },
  async loadState(): Promise<StateResponse> {
    const session = await supa.session();
    if (!session) throw new ApiError('Not signed in', 401);
    const { data, error } = await supa.client().from('user_state').select('data, revision').eq('user_id', session.user.id).maybeSingle();
    if (error) fail(error, 'Could not load workouts.');
    const state = data ? data.data : emptyState();
    if (!validateState(state)) throw new ApiError('Your saved workouts could not be read. Contact support before making changes.', 500);
    return { state, revision: data?.revision ?? 0, user: toUser(session.user) };
  },
  async saveState(state: WorkoutState, revision: number, expectedUserId: string): Promise<SaveResponse> {
    const session = await supa.session();
    if (!session) throw new ApiError('Sign in to save.', 401);
    if (session.user.id !== expectedUserId) throw new ApiError('Your account changed. Reload before saving.', 403);
    const { data, error } = await supa.client().rpc('save_wout_state', { p_data: state, p_revision: revision });
    if (error) fail(error, 'Could not save. Your edits remain on this device.');
    return data as SaveResponse;
  },
};

export const api = {
  kind,
  /** False on a Supabase deployment whose config.min.js has no keys yet. */
  configured: kind === 'server' || hasKeys,
  canResetPassword: kind === 'supabase',
  urlError,
  get recoveryMode() { return recoveryMode; },
  login: (email: string, password: string) => (kind === 'supabase' ? supa.login(email, password) : server.login(email, password)),
  signup: (name: string, email: string, password: string) => (kind === 'supabase' ? supa.signup(name, email, password) : server.signup(name, email, password)),
  logout: () => (kind === 'supabase' ? supa.logout() : server.logout()),
  resetPassword: (email: string) => supa.resetPassword(email),
  updatePassword: (password: string) => supa.updatePassword(password),
  loadState: () => (kind === 'supabase' ? supa.loadState() : server.loadState()),
  saveState: (state: WorkoutState, revision: number, expectedUserId: string) =>
    kind === 'supabase' ? supa.saveState(state, revision, expectedUserId) : server.saveState(state, revision, expectedUserId),
  /** Remove auth tokens / errors from the URL once handled, keeping the hash router clean. */
  cleanUrl() {
    if (/access_token=|error=|type=/.test(window.location.hash)) window.history.replaceState(null, '', window.location.pathname + '#/workout');
  },
};
