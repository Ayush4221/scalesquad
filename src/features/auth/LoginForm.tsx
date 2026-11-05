'use client';
import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { LoginSchema, type LoginDto } from '@scalesquad/shared';
import { FormField } from '@/components/shared/FormField';
import { PasswordInput } from '@/components/shared/PasswordInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api/client';
import { useHydrated } from '@/lib/useHydrated';
import styles from './auth.module.css';

type Field = keyof LoginDto;
type FieldErrors = Partial<Record<Field, string>>;
const messages: Record<Field, string> = {
  email: 'Enter a valid email address.',
  password: 'Enter your password (up to 128 characters).',
};

export function LoginForm() {
  const hydrated = useHydrated();
  const submitting = useRef(false);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  const [values, setValues] = useState<LoginDto>({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  function change(field: Field, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next[field];
      return next;
    });
    setServerError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !hydrated) return;
    const parsed = LoginSchema.safeParse(values);
    if (!parsed.success) {
      const issues: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'email' || field === 'password') issues[field] = messages[field];
      }
      setErrors(issues);
      const firstInvalid = (['email', 'password'] as const).find((field) => issues[field]);
      const input = firstInvalid && event.currentTarget.elements.namedItem(firstInvalid);
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    setErrors({});
    setServerError('');
    try {
      await api('/auth/login', parsed.data);
      setValues((previous) => ({ ...previous, password: '' }));
      // Load the authenticated server page using the new session cookie.
      window.location.assign('/play');
    } catch {
      setServerError('Could not sign in with those details. Check your email and password.');
      submitting.current = false;
      setBusy(false);
      requestAnimationFrame(() => errorMessage.current?.focus());
    }
  }

  const disabled = !hydrated || busy;
  return (
    <>
      <div className={styles.formHeader}>
        <span className={styles.badge}>Back to the control room</span>
        <h1 className={styles.formHeading}>Sign in</h1>
        <p className={styles.formDescription}>Your next incident starts here.</p>
      </div>
      <form
        className={styles.form}
        onSubmit={(event) => void submit(event)}
        noValidate
        aria-busy={busy}
      >
        <FormField id="login-email" label="Email address" error={errors.email}>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@example.com"
            required
            maxLength={254}
            className={styles.input}
            value={values.email}
            disabled={disabled}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            onChange={(event) => change('email', event.target.value)}
          />
        </FormField>
        <FormField id="login-password" label="Password" error={errors.password}>
          <PasswordInput
            id="login-password"
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            required
            maxLength={128}
            className={styles.input}
            value={values.password}
            disabled={disabled}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
            onChange={(event) => change('password', event.target.value)}
          />
        </FormField>
        {serverError && (
          <p ref={errorMessage} className={styles.serverError} role="alert" tabIndex={-1}>
            {serverError}
          </p>
        )}
        <Button type="submit" className={styles.submit} disabled={disabled}>
          {busy ? (
            <>
              Signing in <LoaderCircle className={styles.spinner} aria-hidden="true" />
            </>
          ) : (
            <>
              Sign in <ArrowRight aria-hidden="true" />
            </>
          )}
        </Button>
        <p className={styles.signin}>
          New to ScaleSquad? <a href="/register">Create account</a>
        </p>
      </form>
    </>
  );
}
