'use client';
import { UserRound } from 'lucide-react';
import { initials } from '@/utils/personName';
import { SQUAD_SIZE } from '@/constants/chat';
import { cn } from '@/utils/classNames';
import { roleLabels, type ChatMember } from './types';
export function ChatRoster({
  members,
  userId,
  onMention,
}: {
  members: ChatMember[];
  userId?: string;
  onMention: (name: string) => void;
}) {
  const ordered = [...members].sort(
    (a, b) => Number(b.userId === userId) - Number(a.userId === userId),
  );
  return (
    <div className="space-y-3">
      <p className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Your squad</span>
        <span>
          {members.length} / {SQUAD_SIZE} players
        </span>
      </p>
      <ul className="grid grid-cols-3 gap-2" aria-label="Squad members">
        {Array.from({ length: SQUAD_SIZE }, (_, index) => {
          const member = ordered[index];
          return (
            <li key={member?.userId ?? `seat-${index}`} className="min-w-0">
              {member ? (
                <button
                  type="button"
                  onClick={() => onMention(member.name)}
                  aria-label={`Mention ${member.name}${member.userId === userId ? ' (you)' : ''}`}
                  className={cn(
                    'flex h-full min-h-28 w-full min-w-0 flex-col items-start gap-2 rounded-xl border bg-background p-3 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transform-none motion-reduce:transition-none',
                    member.userId === userId ? 'border-primary' : 'border-border',
                  )}
                >
                  <span
                    className="flex size-8 items-center justify-center rounded-lg bg-muted text-xs font-medium"
                    aria-hidden="true"
                  >
                    {initials(member.name)}
                  </span>
                  <span className="w-full break-words text-xs font-medium">
                    <span className="line-clamp-2 min-h-8">
                      {member.userId === userId ? 'You' : member.name}
                    </span>
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                      {member.role ? roleLabels[member.role] : 'Role at briefing'}
                    </span>
                  </span>
                </button>
              ) : (
                <div className="flex h-full min-h-28 flex-col items-start gap-2 rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                  <UserRound className="size-8" aria-hidden="true" />
                  <span>Waiting for a teammate</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
