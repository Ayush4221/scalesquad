'use client';
import { commonStrings } from '@/constants/strings/common';
import { lobbyStrings } from '@/constants/strings/lobby';

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
  LOBBY: lobbyStrings.lobbyPhaseDescription,
  BRIEFING: lobbyStrings.readYourPrivateEvidenceShareThe,
  REPAIR_1: lobbyStrings.proposeARepairTheNextTwo,
  RUNS_1_2: lobbyStrings.inspectTheBaselineAndIncidentResults,
  INCIDENT_EVIDENCE: lobbyStrings.newPrivateEvidenceAvailableReadYour,
  REPAIR_2: lobbyStrings.reviseYourRepairUsingTheNew,
  RUN_3: lobbyStrings.yourRepairIsRunningUnderThe,
  COMPARE: lobbyStrings.didTheRepairFixCorrectnessAnd,
  FINISHED: lobbyStrings.matchCompleteReviewTheEvidenceAnd,
};
export function MatchShell({ matchId, userId }: { matchId: string; userId: string }) {
  const { view, cards, connection, error, busy, pendingAction, action, setError } =
    useMatch(matchId);
  const [tab, setTab] = useState<MatchTab>(commonStrings.squad),
    [draft, setDraft] = useState<{ text: string; id: number }>(),
    [unread, setUnread] = useState(0);
  useEffect(() => {
    if (view?.phase === 'BRIEFING' || view?.phase === 'INCIDENT_EVIDENCE')
      setTab(commonStrings.brief);
    if (view?.phase === 'REPAIR_1' || view?.phase === 'REPAIR_2') setTab(commonStrings.repair);
    if (view?.phase === 'COMPARE' || view?.phase === 'FINISHED') setTab(commonStrings.results);
  }, [view?.phase]);
  if (!view)
    return (
      <main className={layoutClassName('page-shell')}>
        <p role="status">{error || lobbyStrings.connectingToYourSquad}</p>
        <Link href="/play">{lobbyStrings.backToSquads}</Link>
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
          <div className="flex gap-3">
            {view.ownRole && (
              <Badge>
                {view.ownRole}
                {lobbyStrings.engineerRoleSuffix}
              </Badge>
            )}
          </div>
        </header>
        <section className={layoutClassName('match-heading')}>
          <p className={layoutClassName('eyebrow')}>
            {view.scenario.title} / {view.phase.replaceAll('_', ' ')}
          </p>
          <h1>{commonStrings.keepTheGatesMoving}</h1>
          <p className={layoutClassName('match-intro')}>{directions[view.phase]}</p>
          <div className={layoutClassName('goal-strip')}>
            <span>
              <span aria-hidden="true">◇ </span>
              {lobbyStrings.oneAdmissionPerPass}
            </span>
            <span>
              <span aria-hidden="true">↗ </span>
              {view.scenario.requiredValidAdmissions.toLocaleString()}
              {lobbyStrings.confirmedAdmissions}
            </span>
            <span>
              <span aria-hidden="true">◷ </span>
              {view.scenario.deadlineSeconds}
              {lobbyStrings.seconds}
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
            {lobbyStrings.theRunStoppedSafelyYourConfiguration}
          </p>
        )}
        {view.simulationLocked && (
          <div className={layoutClassName('run-overlay')} role="status">
            <h2>{lobbyStrings.simulationRunning}</h2>
            <p>{lobbyStrings.configurationLockedYourResultWillAppear}</p>
            <progress aria-label={lobbyStrings.simulationRunning} />
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
                    setTab(commonStrings.chat);
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
                  {lobbyStrings.revealIncidentEvidence}
                </Button>
              )}
              {view.phase === 'COMPARE' && isHost && (
                <Button disabled={busy} onClick={() => void action('/advance')}>
                  {lobbyStrings.finishMatch}
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
                  {lobbyStrings.playAgain}
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
                if (tab !== commonStrings.chat) setUnread((n) => n + 1);
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
            if (tab === commonStrings.chat) setUnread(0);
          }}
        />
      </main>
    </SafeAreaView>
  );
}
