'use client';
import { useState } from 'react';
import { Check, Copy, Eye, EyeOff, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function InviteCode({
  code,
  onError,
}: {
  code: string | null;
  onError: (message: string) => void;
}) {
  const [masked, setMasked] = useState(false),
    [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code ?? '');
      setCopied(true);
      onError('');
    } catch {
      onError('Could not copy code. Select the code and copy it manually.');
    }
  }
  async function share() {
    if (!code) return;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Join my ScaleSquad', text: `Join code: ${code}` });
      } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError'))
          onError('Could not share. Use Copy code instead.');
      }
    } else await copy();
  }
  return (
    <div className="space-y-4 rounded-xl border border-border bg-background/70 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">Squad invite code</p>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMasked((value) => !value)}
          aria-label={masked ? 'Show invite code' : 'Hide invite code'}
          className="transition-none"
        >
          {masked ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </Button>
      </div>
      <div
        className="join-code grid max-w-sm grid-cols-8 gap-1.5 font-mono text-xl font-bold text-primary sm:gap-2"
        aria-label={masked ? 'Invite code hidden' : `Invite code: ${code ?? 'unavailable'}`}
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
          Copy code
        </Button>
        <Button
          variant="ghost"
          disabled={!code}
          onClick={() => void share()}
          className="min-h-11 gap-2 transition-none"
        >
          <Share2 aria-hidden="true" />
          Share
        </Button>
        <p role="status" className="text-xs text-primary">
          {copied ? 'Code copied. Share it with your teammates.' : ''}
        </p>
      </div>
    </div>
  );
}
