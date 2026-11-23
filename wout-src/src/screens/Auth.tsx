import { useState, type FormEvent } from 'react';
import { api } from '../lib/api.ts';
import { Icon } from '../components/Icon.tsx';

type Mode = 'login' | 'signup' | 'reset' | 'recovery';

export function AuthScreen({ onSignedIn, initialMode = 'login', initialError = '' }: { onSignedIn: () => void; initialMode?: Mode; initialError?: string }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const switchTo = (m: Mode) => { setMode(m); setError(''); setInfo(''); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'login') { await api.login(email, password); onSignedIn(); }
      else if (mode === 'signup') {
        const result = await api.signup(name, email, password);
        if (result.needsConfirmation) { setMode('login'); setPassword(''); setInfo(`Check ${email.trim()} for a confirmation link, then sign in here.`); }
        else onSignedIn();
      } else if (mode === 'reset') {
        await api.resetPassword(email);
        setInfo('If an account exists for that email, a reset link is on its way.');
      } else {
        await api.updatePassword(password);
        api.cleanUrl();
        onSignedIn();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally { setBusy(false); }
  };

  const submitLabel = { login: 'Sign in', signup: 'Create account', reset: 'Send reset link', recovery: 'Save new password' }[mode];

  return (
    <main className="auth">
      <div className="brand">
        <div className="brand-mark"><Icon name="workout" size={30} stroke={2.6} /></div>
        <div>
          <h1 className="title" style={{ fontSize: 34 }}>Wout</h1>
          <div className="subtitle">A quiet strength log that syncs everywhere.</div>
        </div>
      </div>
      <form className="card stack" onSubmit={submit} style={{ padding: 16 }}>
        {(mode === 'login' || mode === 'signup') && (
          <div className="seg" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => switchTo('login')}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => switchTo('signup')}>Create account</button>
          </div>
        )}
        {mode === 'reset' && <div><div className="card-title">Reset your password</div><div className="card-sub">We’ll email you a link to choose a new one.</div></div>}
        {mode === 'recovery' && <div><div className="card-title">Choose a new password</div><div className="card-sub">You’re signed in from your reset link.</div></div>}
        {mode === 'signup' && (
          <div className="field"><label htmlFor="name">Name</label>
            <input id="name" className="input" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required maxLength={80} /></div>
        )}
        {mode !== 'recovery' && (
          <div className="field"><label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
        )}
        {mode !== 'reset' && (
          <div className="field"><label htmlFor="password">{mode === 'recovery' ? 'New password' : 'Password'}</label>
            <input id="password" className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'login' ? undefined : 8} value={password} onChange={e => setPassword(e.target.value)} required /></div>
        )}
        {error && <div className="error-text" role="alert">{error}</div>}
        {info && <div className="banner info" role="status">{info}</div>}
        <button className="btn primary lg block" disabled={busy} type="submit">{busy ? 'One moment…' : submitLabel}</button>
        {mode === 'login' && api.canResetPassword && <button type="button" className="btn ghost" onClick={() => switchTo('reset')}>Forgot password?</button>}
        {mode === 'reset' && <button type="button" className="btn ghost" onClick={() => switchTo('login')}>Back to sign in</button>}
      </form>
      <p className="tiny muted" style={{ textAlign: 'center' }}>Your workouts sync to your account. Export them anytime from Profile.</p>
    </main>
  );
}

export function SetupScreen() {
  return (
    <main className="auth">
      <div className="brand">
        <div className="brand-mark"><Icon name="workout" size={30} stroke={2.6} /></div>
        <div><h1 className="title" style={{ fontSize: 34 }}>Wout</h1><div className="subtitle">Almost ready</div></div>
      </div>
      <section className="card stack">
        <div className="card-title">Sign-in isn’t connected yet</div>
        <div className="card-sub">This deployment needs its Supabase project URL and anon key in <code>config.min.js</code>. Once they’re added, accounts and sync turn on automatically.</div>
      </section>
    </main>
  );
}
