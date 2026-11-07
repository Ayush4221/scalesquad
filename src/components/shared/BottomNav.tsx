'use client';
import { layoutClassName } from '@/styles/layout';

import type { MatchPhase } from '@scalesquad/shared';
export type MatchTab = 'Brief' | 'Squad' | 'Repair' | 'Results' | 'Chat';
export function BottomNav({
  phase,
  active,
  onSelect,
  unread = 0,
}: {
  phase: MatchPhase;
  active: MatchTab;
  onSelect: (tab: MatchTab) => void;
  unread?: number;
}) {
  return (
    <nav className={layoutClassName('bottom-nav')} aria-label="Match sections">
      {(['Brief', 'Squad', 'Repair', 'Results', 'Chat'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          aria-current={active === tab ? 'page' : undefined}
          disabled={
            (tab === 'Brief' && phase === 'LOBBY') ||
            (tab === 'Repair' && ['LOBBY', 'BRIEFING'].includes(phase)) ||
            (tab === 'Results' && ['LOBBY', 'BRIEFING', 'REPAIR_1'].includes(phase))
          }
          onClick={() => onSelect(tab)}
        >
          {tab}
          {tab === 'Chat' && unread > 0 ? ` (${unread})` : ''}
        </button>
      ))}
    </nav>
  );
}
