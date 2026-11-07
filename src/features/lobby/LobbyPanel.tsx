'use client';
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
              Your control room
            </h2>
            <span className="rounded border border-border bg-background/50 px-2 py-1 text-xs text-muted-foreground">
              {host ? 'Host terminal' : 'Squad member'}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Share your code, fill the squad, and check everyone is ready.
          </p>
        </div>
        <LockKeyhole className="size-5 text-primary" aria-label="Invite-only squad" />
      </div>
      <InviteCode code={view.joinCode} onError={onError} />
      <div className="mt-6 mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Your engineers</h3>
        <span className="rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1 font-mono text-xs">
          {view.members.length} / {SQUAD_SIZE} joined
        </span>
      </div>
      <ul className="roster space-y-3 list-none p-0" aria-label="Joined engineers">
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
                    <span className="text-xs text-muted-foreground">You</span>
                  )}
                  {member.userId === view.hostUserId && (
                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Host
                    </span>
                  )}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Cpu className="size-3 shrink-0" aria-hidden="true" />
                  Role assigned at briefing
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
              {member.ready ? 'Ready' : 'Not ready'}
              <span className="sr-only">Engineer {index + 1}</span>
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
              Waiting for engineer {view.members.length + index + 1}…
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Share the invite code to fill this seat.
            </p>
          </div>
        </div>
      ))}
      <p className="mt-4 text-xs text-muted-foreground">Roles reveal when the match starts.</p>
      <div className="mt-6 space-y-4 border-t border-border pt-5">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Activity className="size-4 text-secondary" aria-hidden="true" />
            {ready} / {SQUAD_SIZE} engineers ready
          </span>
          <span className="font-mono text-muted-foreground">
            {Math.round((ready / SQUAD_SIZE) * 100)}%
          </span>
        </div>
        <div
          className="grid grid-cols-3 gap-1.5"
          role="progressbar"
          aria-label="Squad readiness"
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
            ? 'Waiting for all three engineers to join.'
            : !canStart
              ? 'Everyone must mark ready before the host starts.'
              : host
                ? 'Squad ready. Start when everyone is set.'
                : 'Squad ready. Waiting for your host to start.'}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={busy}
            onClick={() => void action('/ready', { ready: !own?.ready })}
            className="min-h-12 flex-1 gap-2 transition-transform active:scale-95 motion-reduce:transform-none"
          >
            <Check aria-hidden="true" />
            {pendingAction === '/ready' ? 'Saving…' : own?.ready ? 'Not ready' : 'Ready up'}
          </Button>
          {host ? (
            <Button
              variant="outline"
              disabled={busy || !canStart}
              onClick={() => void action('/start')}
              className="min-h-12 flex-1 gap-2 transition-none"
            >
              <Play aria-hidden="true" />
              {pendingAction === '/start' ? 'Starting…' : 'Start match'}
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
              {pendingAction === '/leave' ? 'Leaving…' : 'Leave'}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
