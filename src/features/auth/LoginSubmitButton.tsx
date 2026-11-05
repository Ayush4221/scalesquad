import { ArrowRight, Check, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import styles from './login.module.css';

export type LoginState = 'idle' | 'loading' | 'success';
const labels: Record<LoginState, string> = {
  idle: 'Sign in',
  loading: 'Signing in',
  success: 'Welcome back',
};

export function LoginSubmitButton({ state, disabled }: { state: LoginState; disabled: boolean }) {
  return (
    <Button
      type="submit"
      className={styles.submit}
      data-state={state}
      disabled={disabled}
      aria-label={labels[state]}
      aria-busy={state === 'loading'}
    >
      <span className={styles.idleLayer} data-slot="login-idle" aria-hidden="true">
        <span>Sign in</span>
        <span className={styles.arrowDisc}>
          <ArrowRight />
        </span>
      </span>
      <span className={styles.loadingLayer} data-slot="login-loading" aria-hidden="true">
        <LoaderCircle className={styles.loader} />
        <span>Signing in…</span>
      </span>
      <span className={styles.successLayer} data-slot="login-success" aria-hidden="true">
        <span className={styles.successMark}>
          <Check />
        </span>
        <span>Welcome back</span>
      </span>
    </Button>
  );
}
