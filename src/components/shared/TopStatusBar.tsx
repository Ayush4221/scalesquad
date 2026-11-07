'use client';
import { commonStrings } from '@/constants/strings/common';

import { layoutClassName } from '@/styles/layout';

import { useEffect, useState } from 'react';
import type { MatchPhase } from '@scalesquad/shared';
export function TopStatusBar({
  phase,
  deadline,
  holder,
  connection,
}: {
  phase: MatchPhase;
  deadline: number | null;
  holder: string;
  connection: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className={layoutClassName('status-bar')} role="status">
      <strong>{phase.replaceAll('_', ' ')}</strong>
      <span>
        {deadline && now !== null ? `${Math.max(0, Math.ceil((deadline - now) / 1000))}s` : ''}
      </span>
      <span>
        {commonStrings.editor}
        {holder}
      </span>
      <span data-connection={connection}>
        <span aria-hidden="true">● </span>
        {connection}
      </span>
    </div>
  );
}
