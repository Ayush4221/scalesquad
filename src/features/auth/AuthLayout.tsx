import { authStrings } from '@/constants/strings/auth';
import { commonStrings } from '@/constants/strings/common';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { cn } from '@/utils/classNames';
import { AuthStory } from './AuthStory';
import styles from './auth.module.css';

export function AuthLayout({
  variant,
  children,
}: {
  variant: 'signup' | 'login';
  children: ReactNode;
}) {
  return (
    <main className={cn(styles.page, variant === 'login' && styles.loginPage)}>
      <section className={styles.story} aria-label={authStrings.buildTogetherWithScalesquad}>
        <BrandLogo href="/" />
        <AuthStory variant={variant} />
        {variant === 'login' && (
          <p className={styles.storyFooter}>{authStrings.campuspassIncidentSimulation01}</p>
        )}
      </section>
      <section
        className={styles.formPanel}
        aria-label={variant === 'login' ? commonStrings.signIn : authStrings.createAccount}
      >
        <div className={styles.formContent}>{children}</div>
      </section>
    </main>
  );
}
