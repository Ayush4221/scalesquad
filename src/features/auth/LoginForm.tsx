'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CircleCheck, LockKeyhole, Mail, Zap } from 'lucide-react';
import { LoginSchema, type LoginDto } from '@scalesquad/shared';
import { FormField } from '@/components/shared/FormField';
import { PasswordInput } from '@/components/shared/PasswordInput';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api/client';
import { useHydrated } from '@/hooks/useHydrated';
import { cn } from '@/utils/classNames';
import { LoginSubmitButton, type LoginState } from './LoginSubmitButton';
import styles from './auth.module.css';
import motion from './login.module.css';

type Field = keyof LoginDto;
type FieldErrors = Partial<Record<Field, string>>;
const messages: Record<Field, string> = {
  email: 'Enter a valid email address.',
  password: 'Enter your password (up to 128 characters).',
};

export function LoginForm() {
  const hydrated = useHydrated();
  const submitting = useRef(false);
  const mounted = useRef(true);
  const navigationTimer = useRef<number | undefined>(undefined);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  const [values, setValues] = useState<LoginDto>({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [state, setState] = useState<LoginState>('idle');
  const [emailTouched, setEmailTouched] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const busy = state !== 'idle';
  const emailValid = emailTouched && LoginSchema.shape.email.safeParse(values.email).success;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(navigationTimer.current);
    };
  }, []);

  useEffect(() => {
    if (serverError) errorMessage.current?.focus();
  }, [serverError]);

  function validateEmail() {
    setEmailTouched(true);
    setErrors((previous) => {
      const next = { ...previous };
      if (LoginSchema.shape.email.safeParse(values.email).success) delete next.email;
      else next.email = messages.email;
      return next;
    });
  }

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
    setState('loading');
    setErrors({});
    setServerError('');
    try {
      await api('/auth/login', parsed.data);
      if (!mounted.current) return;
      setValues((previous) => ({ ...previous, password: '' }));
      setState('success');
      // Briefly confirm success, then reload server-rendered pages with the new cookie.
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      navigationTimer.current = window.setTimeout(
        () => window.location.assign('/play'),
        reducedMotion ? 0 : 350,
      );
    } catch {
      if (!mounted.current) return;
      setServerError('Could not sign in with those details. Check your email and password.');
      submitting.current = false;
      setState('idle');
    }
  }

  const disabled = !hydrated || busy;
  return (
    <>
      <div className={cn(styles.formHeader, motion.header)}>
        <span className={cn(styles.badge, motion.badge)}>
          <Zap aria-hidden="true" />
          Back to the control room
        </span>
        <h1 className={styles.formHeading}>Sign in</h1>
        <p className={styles.formDescription}>Your next incident starts here.</p>
      </div>
      <form
        className={cn(styles.form, motion.form)}
        onSubmit={(event) => void submit(event)}
        noValidate
        aria-busy={busy}
      >
        <FormField id="login-email" label="Email address" error={errors.email}>
          <div className={motion.control} data-valid={emailValid}>
            <span className={motion.leading} aria-hidden="true">
              <Mail />
            </span>
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
              className={cn(styles.input, motion.input)}
              value={values.email}
              disabled={disabled}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
              onChange={(event) => change('email', event.target.value)}
              onBlur={validateEmail}
            />
            <span className={motion.validIcon} aria-hidden="true">
              <CircleCheck />
            </span>
          </div>
        </FormField>
        <FormField id="login-password" label="Password" error={errors.password}>
          <PasswordInput
            id="login-password"
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            required
            maxLength={128}
            className={cn(styles.input, motion.input)}
            wrapperClassName={motion.control}
            leadingIcon={<LockKeyhole />}
            value={values.password}
            disabled={disabled}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              [errors.password && 'login-password-error', capsLock && 'login-caps-lock']
                .filter(Boolean)
                .join(' ') || undefined
            }
            onChange={(event) => change('password', event.target.value)}
            onKeyUp={(event) => setCapsLock(event.getModifierState('CapsLock'))}
            onBlur={() => setCapsLock(false)}
          />
          {capsLock && (
            <p id="login-caps-lock" className={motion.capsLock} role="status">
              Caps Lock is on
            </p>
          )}
        </FormField>
        {serverError && (
          <p ref={errorMessage} className={styles.serverError} role="alert" tabIndex={-1}>
            {serverError}
          </p>
        )}
        <LoginSubmitButton state={state} disabled={disabled} />
        <p className="sr-only" role="status">
          {state === 'loading'
            ? 'Signing in. Please wait.'
            : state === 'success'
              ? 'Signed in. Opening your control room.'
              : ''}
        </p>
        <p className={styles.signin}>
          New to ScaleSquad?{' '}
          <a
            href="/register"
            aria-disabled={busy}
            onClick={(event) => {
              if (busy) event.preventDefault();
            }}
          >
            Create account
          </a>
        </p>
      </form>
    </>
  );
}
