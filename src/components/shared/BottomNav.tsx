'use client';
import { commonStrings } from '@/constants/strings/common';
import { chatStrings } from '@/constants/strings/chat';

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
    <nav className={layoutClassName('bottom-nav')} aria-label={commonStrings.matchSections}>
      {(
        [
          commonStrings.brief,
          commonStrings.squad,
          commonStrings.repair,
          commonStrings.results,
          commonStrings.chat,
        ] as const
      ).map((tab) => (
        <button
          key={tab}
          type="button"
          aria-label={tab}
          aria-description={
            tab === commonStrings.chat && unread > 0
              ? chatStrings.unreadMessages(unread)
              : undefined
          }
          aria-current={active === tab ? 'page' : undefined}
          disabled={
            (tab === 'Brief' && phase === 'LOBBY') ||
            (tab === 'Repair' && ['LOBBY', 'BRIEFING'].includes(phase)) ||
            (tab === 'Results' && ['LOBBY', 'BRIEFING', 'REPAIR_1'].includes(phase))
          }
          onClick={() => onSelect(tab)}
        >
          {tab}
          {tab === commonStrings.chat && unread > 0 ? ` (${unread})` : ''}
        </button>
      ))}
    </nav>
  );
}
