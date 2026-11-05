'use client';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { EvidenceCard, PublicMatchView } from '@scalesquad/shared';
import { api } from '@/lib/api/client';
import { WsClient } from '@/lib/ws/client';
import { BriefPanel } from '@/features/brief/BriefPanel';
import { RepairPanel } from '@/features/repair/RepairPanel';
import { ResultsPanel } from '@/features/results/ResultsPanel';
import { ChatPanel } from '@/features/chat/ChatPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  BottomNav,
  TopStatusBar,
  SafeAreaView,
  type MatchTab,
} from '@/components/shared/MatchNavigation';
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
  const [view, setView] = useState<PublicMatchView | null>(null),
    [cards, setCards] = useState<EvidenceCard[]>([]),
    [connection, setConnection] = useState<'connected' | 'reconnecting' | 'offline'>('offline'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<MatchTab>('Squad'),
    [draft, setDraft] = useState<{ text: string; id: number }>(),
    [unread, setUnread] = useState(0);
  const base = `/matches/${matchId}`;
  const accept = useCallback(
    (next: PublicMatchView) =>
      setView((old) => (!old || next.revision >= old.revision ? next : old)),
    [],
  );
  const refresh = useCallback(async () => {
    accept(PublicMatchView.parse(await api(base)));
  }, [accept, base]);
  const evidence = useCallback(async () => {
    setCards(z.array(EvidenceCard).parse(await api(`${base}/evidence`)));
  }, [base]);
  useEffect(() => {
    let active = true;
    void refresh().catch((e) => {
      if (active) setError(e instanceof Error ? e.message : 'Cannot load match');
    });
    const url = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
    const client = new WsClient(
      url,
      (event) => {
        if (!active) return;
        if (event.type === 'hello') {
          client.send({
            v: 1,
            type: 'presence.visibility',
            id: crypto.randomUUID(),
            payload: { foreground: document.visibilityState !== 'hidden' },
          });
          client.send({
            v: 1,
            type: 'match.subscribe',
            id: crypto.randomUUID(),
            payload: { matchId },
          });
        }
        if (event.type === 'match.snapshot') accept(event.payload);
        if (event.type === 'evidence.available')
          void evidence().catch(() => setError('Could not load private evidence'));
        if (event.type === 'error') setError(event.payload.message);
        if (event.type === 'run.completed') void refresh().catch(() => {});
      },
      (state) => {
        if (active) setConnection(state);
      },
    );
    client.connect();
    const visible = () =>
      client.send({
        v: 1,
        type: 'presence.visibility',
        id: crypto.randomUUID(),
        payload: { foreground: document.visibilityState !== 'hidden' },
      });
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      client.close();
      document.removeEventListener('visibilitychange', visible);
    };
  }, [matchId, refresh, evidence, accept]);
  useEffect(() => {
    if (view && view.phase !== 'LOBBY')
      void evidence().catch(() => setError('Could not load private evidence'));
  }, [view?.phase, evidence]);
  useEffect(() => {
    if (view?.phase === 'BRIEFING' || view?.phase === 'INCIDENT_EVIDENCE') setTab('Brief');
    if (view?.phase === 'REPAIR_1' || view?.phase === 'REPAIR_2') setTab('Repair');
    if (view?.phase === 'COMPARE' || view?.phase === 'FINISHED') setTab('Results');
  }, [view?.phase]);
  async function action(path: string, body: unknown = {}) {
    setBusy(true);
    setError('');
    try {
      await api(`${base}${path}`, body);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
      await refresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  if (!view)
    return (
      <main className="page-shell">
        <p role="status">{error || 'Connecting to your squad…'}</p>
        <a href="/play">Back to squads</a>
      </main>
    );
  const own = view.members.find((u) => u.userId === userId),
    isHost = view.hostUserId === userId;
  const canRun = (isHost || view.lock?.holderUserId === userId) && !busy && !view.simulationLocked;
  const repair = ['REPAIR_1', 'REPAIR_2'].includes(view.phase);
  return (
    <SafeAreaView>
      <main className="page-shell match-shell" data-tab={tab}>
        <TopStatusBar
          phase={view.phase}
          deadline={view.deadlineAt}
          holder={
            view.members.find((m) => m.userId === view.lock?.holderUserId)?.name ?? 'Not assigned'
          }
          connection={connection}
        />
        <header className="topbar">
          <a href="/play" className="wordmark">
            ▦ SCALE<span>SQUAD</span>
          </a>
          <div className="flex gap-3">
            <Badge variant="outline">{connection}</Badge>
            {view.ownRole && <Badge>{view.ownRole} ENGINEER</Badge>}
          </div>
        </header>
        <section className="match-heading">
          <p className="eyebrow">CAMPUSPASS / {view.phase.replaceAll('_', ' ')}</p>
          <h1>{view.phase === 'LOBBY' ? 'Assemble your squad.' : 'Keep the gates moving.'}</h1>
          <p className="intro">{directions[view.phase]}</p>
          <div className="goal-strip">
            <span>◇ One admission per pass</span>
            <span>
              ↗ {view.scenario.requiredValidAdmissions.toLocaleString()} confirmed admissions
            </span>
            <span>◷ {view.scenario.deadlineSeconds} seconds</span>
          </div>
        </section>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        {view.runError && (
          <p role="alert" className="error">
            The run stopped safely. Your configuration was kept. Try again.
          </p>
        )}
        {view.simulationLocked && (
          <div className="run-overlay" role="status">
            <h2>Simulation running</h2>
            <p>Configuration locked. Your result will appear here.</p>
            <progress aria-label="Simulation running" />
          </div>
        )}
        <div className="match-grid">
          <div className="space-y-6">
            {view.phase === 'LOBBY' ? (
              <div className="tab-squad">
                <Card>
                  <CardHeader>
                    <CardTitle>Your control room</CardTitle>
                    <div className="join-code">
                      {view.joinCode}
                      <Button
                        variant="outline"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(view.joinCode ?? '')
                            .catch(() => setError('Could not copy code'));
                        }}
                      >
                        Copy code
                      </Button>
                      {typeof navigator !== 'undefined' &&
                        typeof navigator.share === 'function' && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              void navigator
                                .share({
                                  title: 'Join my ScaleSquad',
                                  text: `Join code: ${view.joinCode}`,
                                })
                                .catch(() => {})
                            }
                          >
                            Share
                          </Button>
                        )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="roster">
                      {view.members.map((u) => (
                        <li key={u.userId}>
                          <span>
                            {u.name}
                            {u.userId === view.hostUserId ? ' · Host' : ''}
                          </span>
                          <Badge variant={u.ready ? 'secondary' : 'outline'}>
                            {u.ready ? 'Ready' : 'Joining'}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                    <p className="muted my-4">
                      {view.members.length}/3 engineers · Roles reveal privately when the match
                      starts.
                    </p>
                    <div className="flex gap-3 lobby-actions">
                      <Button
                        disabled={busy}
                        onClick={() => void action('/ready', { ready: !own?.ready })}
                      >
                        {own?.ready ? 'Not ready' : 'Ready up'}
                      </Button>
                      {isHost && (
                        <Button
                          variant="outline"
                          disabled={
                            busy || view.members.length !== 3 || !view.members.every((u) => u.ready)
                          }
                          onClick={() => void action('/start')}
                        >
                          Start match →
                        </Button>
                      )}
                      {!isHost && (
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            void action('/leave').then(() => {
                              window.location.href = '/play';
                            });
                          }}
                        >
                          Leave
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <>
                <div className="tab-brief">
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
                <div className="tab-squad">
                  <Card>
                    <CardHeader>
                      <CardTitle>Your squad</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="roster">
                        {view.members.map((u) => (
                          <li key={u.userId}>
                            {u.name}
                            <span>{u.acknowledged ? 'Acknowledged' : 'Reading'}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
                <div className="tab-repair">
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
                    <div className="run-action">
                      <div>
                        <strong>
                          {view.phase === 'REPAIR_1'
                            ? 'Establish the baseline'
                            : 'Test your repaired design'}
                        </strong>
                        <p className="muted text-sm">
                          {view.phase === 'REPAIR_1'
                            ? 'Runs 1 and 2 use the original preset. Your proposal is saved for Run 3.'
                            : 'The same incident and traffic from Run 2. Only your repair changes.'}
                        </p>
                      </div>
                      <Button
                        disabled={!canRun}
                        onClick={() =>
                          void action('/runs', { runNumber: view.phase === 'REPAIR_1' ? 1 : 3 })
                        }
                      >
                        {busy
                          ? 'Running…'
                          : view.phase === 'REPAIR_1'
                            ? 'Run baseline + incident →'
                            : 'Run repair →'}
                      </Button>
                    </div>
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
                <div className="tab-results">
                  <ResultsPanel runs={view.runs} comparison={view.comparison} />
                </div>
                {view.phase === 'FINISHED' && (
                  <a href="/play" className="play-again">
                    Play again →
                  </a>
                )}
              </>
            )}
          </div>
          <aside className="tab-chat">
            <ChatPanel
              matchId={matchId}
              available={view.chatAvailable}
              members={view.members}
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
