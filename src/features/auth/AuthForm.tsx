'use client';
import { useState } from 'react';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHydrated } from '@/lib/useHydrated';
export type AuthMode = 'login' | 'register' | 'change-password';
const headings: Record<AuthMode, string> = {
  login: 'Sign in',
  register: 'Create account',
  'change-password': 'Change password',
};
export function AuthForm({ mode }: { mode: AuthMode }) {
  const hydrated = useHydrated();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [current, setCurrent] = useState(''),
    [name, setName] = useState(''),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const body =
      mode === 'login'
        ? { email, password }
        : mode === 'register'
          ? { email, password, name }
          : { currentPassword: current, newPassword: password };
    try {
      await api(`/auth/${mode}`, body);
      setPassword('');
      setCurrent('');
      if (mode === 'login') window.location.assign('/play');
      else setDone(true);
    } catch {
      setError(
        mode === 'login'
          ? 'Could not sign in with those details. Check your email and password.'
          : 'Could not complete this step. Check the form and try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <div role="status" className="space-y-4">
        <p>
          {mode === 'register'
            ? 'Registration complete. You can sign in now.'
            : 'Password changed. Other sessions signed out.'}
        </p>
        <a href="/signin">Back to sign in</a>
      </div>
    );
  const needsEmail = mode !== 'change-password';
  return (
    <form className="auth-form space-y-4" onSubmit={(event) => void submit(event)}>
      <h2 className="text-xl font-bold">{headings[mode]}</h2>
      {mode === 'register' && (
        <label>
          Name
          <Input
            autoComplete="name"
            disabled={!hydrated || busy}
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      )}
      {needsEmail && (
        <label>
          Email
          <Input
            type="email"
            disabled={!hydrated || busy}
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
      )}
      {mode === 'change-password' && (
        <label>
          Current password
          <Input
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            disabled={!hydrated || busy}
            required
            maxLength={128}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
      )}
      <label>
        {mode === 'login' ? 'Password' : 'New password'}
        <Input
          type={show ? 'text' : 'password'}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          disabled={!hydrated || busy}
          required
          maxLength={128}
          minLength={mode === 'login' ? 1 : 12}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <Button
        type="button"
        variant="ghost"
        aria-pressed={show}
        disabled={!hydrated || busy}
        onClick={() => setShow((v) => !v)}
      >
        {show ? 'Hide password' : 'Show password'}
      </Button>
      {mode !== 'login' && (
        <p className="muted text-sm" aria-live="polite">
          {[...password.normalize('NFKC')].length >= 12 ? '✓' : '○'} 12–128 characters. Use a
          passphrase. Avoid common passwords and your email name.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <Button className="w-full" type="submit" disabled={!hydrated || busy}>
        {busy ? 'Please wait…' : headings[mode]}
      </Button>
      {mode === 'login' && (
        <p className="flex flex-wrap justify-between gap-3">
          <a href="/register">Create account</a>
        </p>
      )}
    </form>
  );
}
