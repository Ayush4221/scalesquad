'use client';
import { layoutClassName } from '@/styles/layout';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PublicMatchView } from '@scalesquad/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { useMatch } from './useMatch';

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
  const [copied, setCopied] = useState(false);
  const own = view.members.find((member) => member.userId === userId);
  const host = view.hostUserId === userId;
  return (
    <div className={layoutClassName('tab-squad')}>
      <Card>
        <CardHeader>
          <CardTitle>Your control room</CardTitle>
          <div className="join-code flex flex-wrap items-center gap-6 py-5 font-mono text-[28px] tracking-[5px] text-primary max-[650px]:gap-3.5 max-[650px]:text-[22px] max-[650px]:tracking-[3px]">
            {view.joinCode}
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard
                  .writeText(view.joinCode ?? '')
                  .then(() => {
                    setCopied(true);
                    onError('');
                  })
                  .catch(() => onError('Could not copy code'));
              }}
            >
              Copy code
            </Button>
            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
              <Button
                variant="outline"
                onClick={() =>
                  void navigator
                    .share({ title: 'Join my ScaleSquad', text: `Join code: ${view.joinCode}` })
                    .catch(() => {})
                }
              >
                Share
              </Button>
            )}
          </div>
          <p role="status" className={layoutClassName('muted text-sm')}>
            {copied ? 'Code copied. Share it with your teammates.' : ''}
          </p>
        </CardHeader>
        <CardContent>
          <ul className="roster list-none p-0">
            {view.members.map((member) => (
              <li
                key={member.userId}
                className="flex items-center justify-between gap-3 border-b border-border py-4"
              >
                <span>
                  {member.name}
                  {member.userId === view.hostUserId ? ' · Host' : ''}
                </span>
                <Badge variant={member.ready ? 'secondary' : 'outline'}>
                  {member.ready ? 'Ready' : 'Not ready'}
                </Badge>
              </li>
            ))}
          </ul>
          <p className={layoutClassName('muted my-4')}>
            {view.members.length}/3 engineers · Roles reveal when the match starts.
          </p>
          <div className={layoutClassName('flex gap-3 lobby-actions')}>
            <Button disabled={busy} onClick={() => void action('/ready', { ready: !own?.ready })}>
              {pendingAction === '/ready' ? 'Saving…' : own?.ready ? 'Not ready' : 'Ready up'}
            </Button>
            {host ? (
              <Button
                variant="outline"
                disabled={
                  busy || view.members.length !== 3 || !view.members.every((member) => member.ready)
                }
                onClick={() => void action('/start')}
              >
                {pendingAction === '/start' ? 'Starting…' : 'Start match →'}
              </Button>
            ) : (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void action('/leave', {}, false).then((ok) => {
                    if (ok) router.push('/play');
                  })
                }
              >
                {pendingAction === '/leave' ? 'Leaving…' : 'Leave'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
