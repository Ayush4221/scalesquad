'use client';
import { useState } from 'react';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHydrated } from '@/lib/useHydrated';
import {
  ChangePasswordSchema,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
} from '@scalesquad/shared';
import { PasswordRequirements } from './PasswordRequirements';
export function ChangePasswordForm() {
  const hydrated = useHydrated();
  const [password, setPassword] = useState(''),
    [current, setCurrent] = useState(''),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = ChangePasswordSchema.safeParse({
      currentPassword: current,
      newPassword: password,
    });
    if (!parsed.success) {
      setError(
        parsed.error.issues.some((issue) => issue.path[0] === 'newPassword')
          ? PASSWORD_REQUIREMENTS
          : 'Enter your current password.',
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/auth/change-password', parsed.data);
      setPassword('');
      setCurrent('');
      setDone(true);
    } catch {
      setError('Could not complete this step. Check the form and try again.');
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <div role="status" className="space-y-4">
        <p>Password changed. Other sessions signed out.</p>
        <a href="/signin">Back to sign in</a>
      </div>
    );
  return (
    <form className="auth-form space-y-4" onSubmit={(event) => void submit(event)}>
      <h2 className="text-xl font-bold">Change password</h2>
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
      <label>
        New password
        <Input
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          disabled={!hydrated || busy}
          required
          maxLength={128}
          minLength={PASSWORD_MIN_LENGTH}
          aria-describedby="change-password-requirements"
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
      <PasswordRequirements password={password} id="change-password-requirements" />
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <Button className="w-full" type="submit" disabled={!hydrated || busy}>
        {busy ? 'Please wait…' : 'Change password'}
      </Button>
    </form>
  );
}
