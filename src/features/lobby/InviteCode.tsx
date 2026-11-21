'use client';
import { lobbyStrings } from '@/constants/strings/lobby';

import { useEffect, useRef, useState } from 'react';
import { lifecyclePolicy } from '@/constants/lifecycle';
import { Check, Copy, Eye, EyeOff, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function InviteCode({
  code,
  onError,
}: {
  code: string | null;
  onError: (message: string) => void;
}) {
  return <InviteCodeSession key={code} code={code} onError={onError} />;
}
function InviteCodeSession({
  code,
  onError,
}: {
  code: string | null;
  onError: (message: string) => void;
}) {
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [masked, setMasked] = useState(false),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), lifecyclePolicy.copiedFeedbackMs);
    return () => clearTimeout(timer);
  }, [copied]);
  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code ?? '');
      if (active.current) {
        setCopied(true);
        onError('');
      }
    } catch {
      if (active.current) onError(lobbyStrings.couldNotCopyCodeSelectThe);
    }
  }
  async function share() {
    if (!code) return;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: lobbyStrings.joinMyScalesquad,
          text: lobbyStrings.shareCode(code),
        });
      } catch (error) {
        if (active.current && !(error instanceof Error && error.name === 'AbortError'))
          onError(lobbyStrings.couldNotShareUseCopyCode);
      }
    } else await copy();
  }
  return (
    <div className="space-y-4 rounded-xl border border-border bg-background/70 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{lobbyStrings.squadInviteCode}</p>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMasked((value) => !value)}
          aria-label={masked ? lobbyStrings.showInviteCode : lobbyStrings.hideInviteCode}
          className="transition-none"
        >
          {masked ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </Button>
      </div>
      <div
        className="join-code grid max-w-sm grid-cols-8 gap-1.5 font-mono text-xl font-bold text-primary sm:gap-2"
        aria-label={masked ? lobbyStrings.inviteCodeHidden : lobbyStrings.inviteCodeLabel(code)}
      >
        {Array.from(code ?? '--------').map((letter, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="flex h-11 min-w-0 items-center justify-center rounded-lg border border-success-border bg-linear-to-b from-muted/70 to-card shadow-inner"
          >
            {masked ? '•' : letter}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          disabled={!code}
          onClick={() => void copy()}
          className="min-h-11 gap-2 transition-transform active:scale-95 motion-reduce:transform-none"
        >
          {copied ? (
            <Check className="text-primary" aria-hidden="true" />
          ) : (
            <Copy className="text-primary" aria-hidden="true" />
          )}
          {lobbyStrings.copyCode}
        </Button>
        <Button
          variant="ghost"
          disabled={!code}
          onClick={() => void share()}
          className="min-h-11 gap-2 transition-none"
        >
          <Share2 aria-hidden="true" />
          {lobbyStrings.share}
        </Button>
        <p role="status" className="text-xs text-primary">
          {copied ? lobbyStrings.codeCopiedShareItWithYour : ''}
        </p>
      </div>
    </div>
  );
}
