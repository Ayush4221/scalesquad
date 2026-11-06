'use client';

import Link, { useLinkStatus } from 'next/link';
import { ArrowUpRight, LoaderCircle } from 'lucide-react';
import styles from './landing.module.css';

function ActionContent({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return (
    <span className={styles.actionContent} data-pending={pending} aria-busy={pending}>
      <span>{label}</span>
      <span className={styles.actionIcon} aria-hidden="true">
        <ArrowUpRight className={styles.actionArrow} />
        <LoaderCircle className={styles.actionLoader} />
      </span>
      {pending && (
        <span className="sr-only" role="status">
          Opening your next step…
        </span>
      )}
    </span>
  );
}

export function LandingAction({ label = 'Create your squad' }: { label?: string }) {
  return (
    <Link href="/register" className={styles.primaryAction}>
      <ActionContent label={label} />
    </Link>
  );
}
