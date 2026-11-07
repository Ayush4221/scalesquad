'use client';
import { landingClassName } from './landingStyles';

import Link, { useLinkStatus } from 'next/link';
import { LoaderCircle } from 'lucide-react';

function Content({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span>{label}</span>
      <span className={landingClassName('hm-action-status')} aria-hidden="true">
        {pending && <LoaderCircle />}
      </span>
      {pending && (
        <span className="sr-only" role="status">
          Opening signup…
        </span>
      )}
    </>
  );
}
export function HomeAction({ secondary = false }: { secondary?: boolean }) {
  return (
    <Link
      href="/register"
      className={landingClassName(secondary ? 'hm-link hm-account-link' : 'hm-primary')}
    >
      <Content label={secondary ? 'Create an account' : 'Build your squad'} />
    </Link>
  );
}
