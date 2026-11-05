'use client';
import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, LoaderCircle } from 'lucide-react';
import {
  RegisterSchema,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
  type RegisterDto,
} from '@scalesquad/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/FormField';
import { PasswordInput } from '@/components/shared/PasswordInput';
import { api } from '@/lib/api/client';
import { useHydrated } from '@/lib/useHydrated';
import styles from './auth.module.css';
import { PasswordRequirements } from './PasswordRequirements';

type Field = keyof RegisterDto;
type FieldErrors = Partial<Record<Field, string>>;
const messages: Record<Field, string> = {
  name: 'Enter your full name (up to 60 characters).',
  email: 'Enter a valid email address.',
  password: PASSWORD_REQUIREMENTS,
};

function validate(values: RegisterDto): FieldErrors {
  const errors: FieldErrors = {};
  const parsed = RegisterSchema.safeParse(values);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === 'name' || field === 'email' || field === 'password')
        errors[field] = messages[field];
    }
  }
  return errors;
}

export function SignupForm() {
  const hydrated = useHydrated();
  const submitting = useRef(false);
  const [values, setValues] = useState<RegisterDto>({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

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
    const issues = validate(values);
    setErrors(issues);
    const firstInvalid = (['name', 'email', 'password'] as const).find((field) => issues[field]);
    if (firstInvalid) {
      const field = event.currentTarget.elements.namedItem(firstInvalid);
      if (field instanceof HTMLInputElement) field.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    setServerError('');
    try {
      await api('/auth/register', RegisterSchema.parse(values));
      setValues((previous) => ({ ...previous, password: '' }));
      setDone(true);
    } catch {
      setServerError('We couldn’t create your account. Check your details and try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className={styles.success} role="status">
        <span className={styles.successIcon}>
          <Check aria-hidden="true" />
        </span>
        <h1 className={styles.formHeading}>You’re ready to sign in.</h1>
        <p className={styles.formDescription}>Registration complete. You can sign in now.</p>
        <a className={styles.continueLink} href="/signin">
          Continue to sign in <ArrowRight aria-hidden="true" />
        </a>
      </div>
    );
  }

  const disabled = !hydrated || busy;
  return (
    <>
      <div className={styles.formHeader}>
        <span className={styles.badge}>Join the squad</span>
        <h1 className={styles.formHeading}>Create your account</h1>
        <p className={styles.formDescription}>One account. A whole squad of possibilities.</p>
      </div>
      <form
        className={styles.form}
        onSubmit={(event) => void submit(event)}
        noValidate
        aria-busy={busy}
      >
        <FormField id="signup-name" label="Full name" error={errors.name}>
          <Input
            id="signup-name"
            name="name"
            autoComplete="name"
            placeholder="Enter your full name"
            required
            maxLength={60}
            className={styles.input}
            value={values.name}
            disabled={disabled}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'signup-name-error' : undefined}
            onChange={(event) => change('name', event.target.value)}
          />
        </FormField>
        <FormField id="signup-email" label="Email address" error={errors.email}>
          <Input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Enter your email address"
            required
            maxLength={254}
            className={styles.input}
            value={values.email}
            disabled={disabled}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'signup-email-error' : undefined}
            onChange={(event) => change('email', event.target.value)}
          />
        </FormField>
        <FormField
          id="signup-password"
          label="Password"
          error={errors.password}
          hint="Up to 128 characters. Avoid common passwords and your email name."
        >
          <PasswordInput
            id="signup-password"
            name="password"
            autoComplete="new-password"
            placeholder="Create a password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={128}
            className={styles.input}
            value={values.password}
            disabled={disabled}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={`signup-password-requirements ${errors.password ? 'signup-password-error' : 'signup-password-hint'}`}
            onChange={(event) => change('password', event.target.value)}
          />
          <PasswordRequirements password={values.password} id="signup-password-requirements" />
        </FormField>
        {serverError && (
          <p className={styles.serverError} role="alert">
            {serverError}
          </p>
        )}
        <Button type="submit" className={styles.submit} disabled={disabled}>
          {busy ? (
            <>
              Creating account <LoaderCircle className={styles.spinner} aria-hidden="true" />
            </>
          ) : (
            <>
              Create account <ArrowRight aria-hidden="true" />
            </>
          )}
        </Button>
        <p className={styles.signin}>
          Already playing? <a href="/signin">Sign in</a>
        </p>
      </form>
    </>
  );
}
