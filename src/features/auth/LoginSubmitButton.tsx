import { authStrings } from '@/constants/strings/auth';
import { commonStrings } from '@/constants/strings/common';
import { ArrowRight, Check, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import styles from './login.module.css';

export type LoginState = 'idle' | 'loading' | 'success';
const labels: Record<LoginState, string> = {
  idle: commonStrings.signIn,
  loading: authStrings.signingIn,
  success: authStrings.signInSuccess,
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
        <span>{commonStrings.signIn}</span>
        <span className={styles.arrowDisc}>
          <ArrowRight />
        </span>
      </span>
      <span className={styles.loadingLayer} data-slot="login-loading" aria-hidden="true">
        <LoaderCircle className={styles.loader} />
        <span>{authStrings.signingInPending}</span>
      </span>
      <span className={styles.successLayer} data-slot="login-success" aria-hidden="true">
        <span className={styles.successMark}>
          <Check />
        </span>
        <span>{authStrings.signInSuccess}</span>
      </span>
    </Button>
  );
}
