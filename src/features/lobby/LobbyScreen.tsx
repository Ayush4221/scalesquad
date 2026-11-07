'use client';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Timer, TrendingUp } from 'lucide-react';
import type { PublicMatchView } from '@scalesquad/shared';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { SafeAreaView } from '@/components/shared/SafeAreaView';
import { ChatPanel } from '@/features/chat/ChatPanel';
import { layoutClassName } from '@/styles/layout';
import { LobbyPanel } from './LobbyPanel';
import type { useMatch } from './useMatch';

export function LobbyScreen({
  view,
  userId,
  connection,
  error,
  busy,
  pendingAction,
  action,
  onError,
}: {
  view: PublicMatchView;
  userId: string;
  connection: string;
  error: string;
  busy: boolean;
  pendingAction: string | null;
  action: ReturnType<typeof useMatch>['action'];
  onError: (message: string) => void;
}) {
  const goals = [
    {
      icon: ShieldCheck,
      label: 'Correctness',
      value: 'One admission per pass',
      color: 'text-primary',
    },
    {
      icon: TrendingUp,
      label: 'Load target',
      value: `${view.scenario.requiredValidAdmissions.toLocaleString()} confirmed admissions`,
      color: 'text-primary',
    },
    {
      icon: Timer,
      label: 'Deadline',
      value: `${view.scenario.deadlineSeconds} seconds`,
      color: 'text-warning',
    },
  ];
  return (
    <SafeAreaView>
      <div className="min-h-dvh bg-lobby-grid bg-size-[36px_36px] font-brand-body">
        <header className="border-b border-border bg-background/90">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
            <div className="status-bar flex flex-wrap items-center gap-4 text-xs" role="status">
              <span className="rounded-md border border-border bg-card px-3 py-1.5 font-mono font-semibold">
                LOBBY
              </span>
              <span className="hidden text-muted-foreground sm:inline">Editor: Not assigned</span>
              <span className={connection === 'connected' ? 'text-primary' : 'text-warning'}>
                {connection}
              </span>
            </div>
            <Link
              href="/play"
              className="inline-flex min-h-11 items-center gap-2 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-ring"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to squads
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-8 sm:py-8">
          <section className="flex flex-col justify-between gap-6 border-b border-border pb-6 xl:flex-row xl:items-end">
            <div className="min-w-0 space-y-3">
              <BrandLogo />
              <p className="pt-2 text-sm text-muted-foreground">
                {view.scenario.title} <span aria-hidden="true">/</span>{' '}
                <span className="text-primary">Squad lobby</span>
              </p>
              <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
                Assemble your squad.
              </h1>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                Bring three engineers together. Mark ready when your squad is here. Your private
                roles reveal at briefing.
              </p>
            </div>
            <dl className="flex flex-wrap gap-3">
              {goals.map(({ icon: Icon, label, value, color }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card/90 px-3.5 py-3"
                >
                  <Icon className={`size-5 shrink-0 ${color}`} aria-hidden="true" />
                  <div>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className={`mt-1 font-mono text-xs ${color}`}>{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>
          {error && (
            <p role="alert" className={layoutClassName('error')}>
              {error}
            </p>
          )}
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <LobbyPanel
              view={view}
              userId={userId}
              busy={busy}
              pendingAction={pendingAction}
              action={action}
              onError={onError}
            />
            <aside className="min-w-0">
              <ChatPanel
                matchId={view.id}
                available={view.chatAvailable}
                members={view.members}
                userId={userId}
                showRoster={false}
              />
            </aside>
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-5 text-xs text-muted-foreground">
            <p>Three engineers. Private clues. One shared repair.</p>
            <p>Chat is available while you assemble your squad.</p>
          </footer>
        </main>
      </div>
    </SafeAreaView>
  );
}
