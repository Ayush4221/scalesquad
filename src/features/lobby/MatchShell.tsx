'use client';
import { layoutClassName } from '@/styles/layout';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMatch } from './useMatch';
import { LobbyScreen } from './LobbyScreen';
import { SquadPanel } from './SquadPanel';
import { RunAction } from './RunAction';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { BriefPanel } from '@/features/brief/BriefPanel';
import { RepairPanel } from '@/features/repair/RepairPanel';
import { ResultsPanel } from '@/features/results/ResultsPanel';
import { ChatPanel } from '@/features/chat/ChatPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BottomNav, type MatchTab } from '@/components/shared/BottomNav';
import { TopStatusBar } from '@/components/shared/TopStatusBar';
import { SafeAreaView } from '@/components/shared/SafeAreaView';
const directions: Record<string, string> = {
  LOBBY: 'Bring three engineers together. Mark ready when your squad is here.',
  BRIEFING: 'Read your private evidence. Share the facts your squad needs.',
  REPAIR_1: 'Propose a repair. The next two runs test the original preset.',
  RUNS_1_2: 'Inspect the baseline and incident results. Then reveal new evidence.',
  INCIDENT_EVIDENCE:
    'New private evidence available. Read your update and discuss it with your squad.',
  REPAIR_2: 'Revise your repair using the new evidence. Run 3 tests this configuration.',
  RUN_3: 'Your repair is running under the same incident.',
  COMPARE: 'Did the repair fix correctness and throughput within budget?',
  FINISHED: 'Match complete. Review the evidence and explain what changed.',
};
export function MatchShell({ matchId, userId }: { matchId: string; userId: string }) {
  const { view, cards, connection, error, busy, pendingAction, action, setError } =
    useMatch(matchId);
  const [tab, setTab] = useState<MatchTab>('Squad'),
    [draft, setDraft] = useState<{ text: string; id: number }>(),
    [unread, setUnread] = useState(0);
  useEffect(() => {
    if (view?.phase === 'BRIEFING' || view?.phase === 'INCIDENT_EVIDENCE') setTab('Brief');
    if (view?.phase === 'REPAIR_1' || view?.phase === 'REPAIR_2') setTab('Repair');
    if (view?.phase === 'COMPARE' || view?.phase === 'FINISHED') setTab('Results');
  }, [view?.phase]);
  if (!view)
    return (
      <main className={layoutClassName('page-shell')}>
        <p role="status">{error || 'Connecting to your squad…'}</p>
        <Link href="/play">Back to squads</Link>
      </main>
    );
  const own = view.members.find((u) => u.userId === userId),
    isHost = view.hostUserId === userId;
  const repair = ['REPAIR_1', 'REPAIR_2'].includes(view.phase);
  if (view.phase === 'LOBBY')
    return (
      <LobbyScreen
        view={view}
        userId={userId}
        connection={connection}
        error={error}
        busy={busy}
        pendingAction={pendingAction}
        action={action}
        onError={setError}
      />
    );
  return (
    <SafeAreaView>
      <main className={layoutClassName('page-shell match-shell')} data-tab={tab}>
        <TopStatusBar
          phase={view.phase}
          deadline={view.deadlineAt}
          holder={
            view.members.find((m) => m.userId === view.lock?.holderUserId)?.name ?? 'Not assigned'
          }
          connection={connection}
        />
        <header className={layoutClassName('topbar')}>
          <BrandLogo />
          <div className="flex gap-3">{view.ownRole && <Badge>{view.ownRole} ENGINEER</Badge>}</div>
        </header>
        <section className={layoutClassName('match-heading')}>
          <p className={layoutClassName('eyebrow')}>
            {view.scenario.title} / {view.phase.replaceAll('_', ' ')}
          </p>
          <h1>Keep the gates moving.</h1>
          <p className={layoutClassName('match-intro')}>{directions[view.phase]}</p>
          <div className={layoutClassName('goal-strip')}>
            <span>
              <span aria-hidden="true">◇ </span>One admission per pass
            </span>
            <span>
              <span aria-hidden="true">↗ </span>
              {view.scenario.requiredValidAdmissions.toLocaleString()} confirmed admissions
            </span>
            <span>
              <span aria-hidden="true">◷ </span>
              {view.scenario.deadlineSeconds} seconds
            </span>
          </div>
        </section>
        {error && (
          <div role="alert" className={layoutClassName('error')}>
            {error}
          </div>
        )}
        {view.runError && (
          <p role="alert" className={layoutClassName('error')}>
            The run stopped safely. Your configuration was kept. Try again.
          </p>
        )}
        {view.simulationLocked && (
          <div className={layoutClassName('run-overlay')} role="status">
            <h2>Simulation running</h2>
            <p>Configuration locked. Your result will appear here.</p>
            <progress aria-label="Simulation running" />
          </div>
        )}
        <div className={layoutClassName('match-grid')}>
          <div className="space-y-6">
            <>
              <div className={layoutClassName('tab-brief')}>
                <BriefPanel
                  cards={cards}
                  acknowledged={
                    own?.acknowledged === true ||
                    !['BRIEFING', 'INCIDENT_EVIDENCE'].includes(view.phase)
                  }
                  busy={busy}
                  onAcknowledge={() => void action('/acknowledge')}
                  onShare={(text) => {
                    setDraft({ text, id: Date.now() });
                    setTab('Chat');
                    setUnread(0);
                  }}
                />
              </div>
              <SquadPanel view={view} />
              <div className={layoutClassName('tab-repair')}>
                <RepairPanel
                  view={view}
                  userId={userId}
                  busy={busy}
                  onChange={(change) =>
                    void action('/config', {
                      change,
                      expectedVersion: view.configuration.version,
                    })
                  }
                  onPass={(targetUserId) => void action('/lock/pass', { targetUserId })}
                  onReclaim={() => void action('/lock/reclaim')}
                />
                {repair && (
                  <RunAction
                    view={view}
                    userId={userId}
                    pendingAction={pendingAction}
                    action={action}
                  />
                )}
              </div>
              {view.phase === 'RUNS_1_2' && isHost && (
                <Button
                  disabled={busy || view.simulationLocked || view.runs.length < 2}
                  onClick={() => void action('/advance')}
                >
                  Reveal incident evidence →
                </Button>
              )}
              {view.phase === 'COMPARE' && isHost && (
                <Button disabled={busy} onClick={() => void action('/advance')}>
                  Finish match
                </Button>
              )}
              <div className={layoutClassName('tab-results')}>
                <ResultsPanel
                  runs={view.runs}
                  comparison={view.comparison}
                  presetConfiguration={view.scenario.presetConfiguration}
                  repairedConfiguration={view.configuration.values}
                />
              </div>
              {view.phase === 'FINISHED' && (
                <Link href="/play" className={layoutClassName('play-again')}>
                  Play again →
                </Link>
              )}
            </>
          </div>
          <aside className={layoutClassName('tab-chat')}>
            <ChatPanel
              matchId={matchId}
              available={view.chatAvailable}
              members={view.members}
              userId={userId}
              cards={cards}
              {...(draft ? { draft } : {})}
              onIncoming={() => {
                if (tab !== 'Chat') setUnread((n) => n + 1);
              }}
            />
          </aside>
        </div>
        <BottomNav
          phase={view.phase}
          active={tab}
          unread={unread}
          onSelect={(tab) => {
            setTab(tab);
            if (tab === 'Chat') setUnread(0);
          }}
        />
      </main>
    </SafeAreaView>
  );
}
