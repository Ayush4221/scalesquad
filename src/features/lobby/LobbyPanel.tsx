'use client';
import { commonStrings } from '@/constants/strings/common';
import { lobbyStrings } from '@/constants/strings/lobby';

import { useRouter } from 'next/navigation';
import { Activity, Check, Cpu, LockKeyhole, LogOut, Play, UserPlus } from 'lucide-react';
import type { PublicMatchView } from '@scalesquad/shared';
import { Button } from '@/components/ui/button';
import { initials } from '@/utils/personName';
import { cn } from '@/utils/classNames';
import { SQUAD_SIZE } from '@/constants/chat';
import type { useMatch } from './useMatch';
import { InviteCode } from './InviteCode';

export function LobbyPanel({
  view,
  userId,
  busy,
  pendingAction,
  action,
  onError,
}: {
  view: PublicMatchView;
  userId: string;
  busy: boolean;
  pendingAction: string | null;
  action: ReturnType<typeof useMatch>['action'];
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const own = view.members.find((member) => member.userId === userId);
  const host = view.hostUserId === userId;
  const ready = view.members.filter((member) => member.ready).length;
  const full = view.members.length === SQUAD_SIZE;
  const canStart = full && ready === SQUAD_SIZE;
  return (
    <section
      aria-labelledby="control-room-title"
      className="tab-squad min-w-0 overflow-clip rounded-2xl border border-border border-t-primary/60 bg-linear-to-b from-muted/40 to-card p-5 shadow-xl shadow-background/40 sm:p-7"
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="control-room-title" className="text-xl font-semibold tracking-tight">
              {lobbyStrings.yourControlRoom}
            </h2>
            <span className="rounded border border-border bg-background/50 px-2 py-1 text-xs text-muted-foreground">
              {host ? lobbyStrings.hostTerminal : commonStrings.squadMember}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {lobbyStrings.shareYourCodeFillTheSquad}
          </p>
        </div>
        <LockKeyhole className="size-5 text-primary" aria-label={lobbyStrings.inviteOnlySquad} />
      </div>
      <InviteCode code={view.joinCode} onError={onError} />
      <div className="mt-6 mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">{lobbyStrings.yourEngineers}</h3>
        <span className="rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1 font-mono text-xs">
          {view.members.length} / {SQUAD_SIZE}
          {lobbyStrings.joined}
        </span>
      </div>
      <ul className="roster space-y-3 list-none p-0" aria-label={lobbyStrings.joinedEngineers}>
        {view.members.map((member, index) => (
          <li
            key={member.userId}
            className={cn(
              'flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-background/40 p-4',
              member.ready ? 'border-success-border' : 'border-border',
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-xl border font-mono text-sm font-semibold',
                  member.ready
                    ? 'border-success-border bg-success-background text-primary'
                    : 'border-border bg-muted text-foreground',
                )}
                aria-hidden="true"
              >
                {initials(member.name)}
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 break-words text-sm font-medium">
                  {member.name}
                  {member.userId === userId && (
                    <span className="text-xs text-muted-foreground">{commonStrings.you}</span>
                  )}
                  {member.userId === view.hostUserId && (
                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {lobbyStrings.host}
                    </span>
                  )}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Cpu className="size-3 shrink-0" aria-hidden="true" />
                  {lobbyStrings.roleAssignedAtBriefing}
                </p>
              </div>
            </div>
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs',
                member.ready
                  ? 'border-success-border bg-success-background text-primary'
                  : 'border-border text-muted-foreground',
              )}
            >
              {member.ready && <Check className="size-3" aria-hidden="true" />}
              {member.ready ? lobbyStrings.ready : lobbyStrings.notReady}
              <span className="sr-only">
                {lobbyStrings.engineer}
                {index + 1}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {Array.from({ length: SQUAD_SIZE - view.members.length }, (_, index) => (
        <div
          key={index}
          className="mt-3 flex items-center gap-3 rounded-xl border border-dashed border-border bg-background/20 p-4"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
            <UserPlus className="size-5 text-muted-foreground" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm text-muted-foreground">
              {lobbyStrings.waitingForEngineer}
              {view.members.length + index + 1}…
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {lobbyStrings.shareTheInviteCodeToFill}
            </p>
          </div>
        </div>
      ))}
      <p className="mt-4 text-xs text-muted-foreground">
        {lobbyStrings.rolesRevealWhenTheMatchStarts}
      </p>
      <div className="mt-6 space-y-4 border-t border-border pt-5">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Activity className="size-4 text-secondary" aria-hidden="true" />
            {ready} / {SQUAD_SIZE}
            {lobbyStrings.engineersReady}
          </span>
          <span className="font-mono text-muted-foreground">
            {Math.round((ready / SQUAD_SIZE) * 100)}%
          </span>
        </div>
        <div
          className="grid grid-cols-3 gap-1.5"
          role="progressbar"
          aria-label={lobbyStrings.squadReadiness}
          aria-valuemin={0}
          aria-valuemax={SQUAD_SIZE}
          aria-valuenow={ready}
        >
          {Array.from({ length: SQUAD_SIZE }, (_, index) => (
            <span
              key={index}
              className={cn('h-1.5 rounded-full', index < ready ? 'bg-primary' : 'bg-muted')}
            />
          ))}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {!full
            ? lobbyStrings.waitingForAllThreeEngineersTo
            : !canStart
              ? lobbyStrings.everyoneMustMarkReadyBeforeThe
              : host
                ? lobbyStrings.squadReadyStartWhenEveryoneIs
                : lobbyStrings.squadReadyWaitingForYourHost}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={busy}
            onClick={() => void action('/ready', { ready: !own?.ready })}
            className="min-h-12 flex-1 gap-2 transition-transform active:scale-95 motion-reduce:transform-none"
          >
            <Check aria-hidden="true" />
            {pendingAction === '/ready'
              ? lobbyStrings.saving
              : own?.ready
                ? lobbyStrings.notReady
                : lobbyStrings.readyUp}
          </Button>
          {host ? (
            <Button
              variant="outline"
              disabled={busy || !canStart}
              onClick={() => void action('/start')}
              className="min-h-12 flex-1 gap-2 transition-none"
            >
              <Play aria-hidden="true" />
              {pendingAction === '/start' ? lobbyStrings.starting : lobbyStrings.startMatch}
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={busy}
              className="min-h-12 gap-2 transition-none"
              onClick={() =>
                void action('/leave', {}, false).then((ok) => {
                  if (ok) router.push('/play');
                })
              }
            >
              <LogOut aria-hidden="true" />
              {pendingAction === '/leave' ? lobbyStrings.leaving : lobbyStrings.leave}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
