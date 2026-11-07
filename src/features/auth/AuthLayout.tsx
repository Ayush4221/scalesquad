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
      <section className={styles.story} aria-label="Build together with ScaleSquad">
        <BrandLogo href="/" />
        <AuthStory variant={variant} />
        {variant === 'login' && (
          <p className={styles.storyFooter}>CampusPass / Incident simulation 01</p>
        )}
      </section>
      <section
        className={styles.formPanel}
        aria-label={variant === 'login' ? 'Sign in' : 'Create account'}
      >
        <div className={styles.formContent}>{children}</div>
      </section>
    </main>
  );
}
