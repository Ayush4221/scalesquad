'use client';
import { authStrings } from '@/constants/strings/auth';
import { commonStrings } from '@/constants/strings/common';

import { layoutClassName } from '@/styles/layout';

import { useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHydrated } from '@/hooks/useHydrated';
import {
  ChangePasswordSchema,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
} from '@scalesquad/shared';
import { PasswordRequirements } from './PasswordRequirements';
export function ChangePasswordForm() {
  const hydrated = useHydrated();
  const submitting = useRef(false);
  const [password, setPassword] = useState(''),
    [current, setCurrent] = useState(''),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!hydrated || submitting.current) return;
    const parsed = ChangePasswordSchema.safeParse({
      currentPassword: current,
      newPassword: password,
    });
    if (!parsed.success) {
      setError(
        parsed.error.issues.some((issue) => issue.path[0] === 'newPassword')
          ? PASSWORD_REQUIREMENTS
          : authStrings.enterYourCurrentPassword,
      );
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await api('/auth/change-password', parsed.data);
      setPassword('');
      setCurrent('');
      setDone(true);
    } catch {
      setError(authStrings.couldNotCompleteThisStepCheck);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  if (done)
    return (
      <div role="status" className="space-y-4">
        <p>{authStrings.passwordChangedOtherSessionsSignedOut}</p>
        <a href="/signin">{authStrings.backToSignIn}</a>
      </div>
    );
  return (
    <form className="auth-form space-y-4" onSubmit={(event) => void submit(event)}>
      <h2 className="text-xl font-bold">{authStrings.changePassword}</h2>
      <label>
        {authStrings.currentPassword}
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
        {authStrings.newPassword}
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
        {show ? commonStrings.hidePassword : commonStrings.showPassword}
      </Button>
      <PasswordRequirements password={password} id="change-password-requirements" />
      {error && (
        <p role="alert" className={layoutClassName('error')}>
          {error}
        </p>
      )}
      <Button className="w-full" type="submit" disabled={!hydrated || busy}>
        {busy ? authStrings.pleaseWait : authStrings.changePassword}
      </Button>
    </form>
  );
}
