'use client';
import { chatStrings } from '@/constants/strings/chat';
import { commonStrings } from '@/constants/strings/common';

import { useEffect, useMemo, useRef } from 'react';
import { MessageSquare, Reply } from 'lucide-react';
import { contentHash } from '@scalesquad/shared';
import { Button } from '@/components/ui/button';
import { initials } from '@/utils/personName';
import type { ChatMessage } from '@/lib/nexconn/client';
import { roleLabels, type ChatMember } from './types';
export interface ChatReply {
  name: string;
  text: string;
}
export function ChatMessages({
  messages,
  members,
  onReply,
}: {
  messages: ChatMessage[];
  members: ChatMember[];
  onReply: (reply: ChatReply) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const senders = useMemo(
    () => new Map(members.map((member) => [`u${contentHash(member.userId).slice(0, 48)}`, member])),
    [members],
  );
  useEffect(() => {
    const node = viewport.current;
    if (node && follow.current) node.scrollTop = node.scrollHeight;
  }, [messages]);
  return (
    <div
      ref={viewport}
      onScroll={() => {
        const node = viewport.current;
        if (node) follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 64;
      }}
      className="chat-messages min-h-40 max-h-96 space-y-5 overflow-y-auto overscroll-contain py-2 pr-1"
      role="log"
      aria-label={chatStrings.squadMessages}
      aria-live="polite"
      aria-relevant="additions text"
    >
      {messages.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 px-4 text-center">
          <MessageSquare className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">{chatStrings.startWithWhatYouKnow}</p>
          <p className="max-w-64 text-xs leading-5 text-muted-foreground">
            {chatStrings.shareTheFactsThatCouldChange}
          </p>
        </div>
      ) : (
        messages.map((message) => {
          const member = senders.get(message.sender);
          const system = message.sender === 'scalesquadsystem';
          const name = system
            ? commonStrings.scalesquad
            : (member?.name ?? commonStrings.squadMember);
          const date = new Date(message.sentAt);
          const validDate = Number.isFinite(date.getTime());
          return (
            <article key={message.id} className="chat-message flex min-w-0 gap-3">
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-medium"
                aria-hidden="true"
              >
                {initials(name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <strong className="break-words text-xs font-medium">{name}</strong>
                  {member?.role && (
                    <span className="text-xs text-muted-foreground">{roleLabels[member.role]}</span>
                  )}
                  {validDate && (
                    <time className="text-xs text-muted-foreground" dateTime={date.toISOString()}>
                      {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">
                  {message.text}
                </p>
                {!system && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 min-h-11 px-0 text-xs text-muted-foreground transition-none"
                    onClick={() => onReply({ name, text: message.text })}
                    aria-label={chatStrings.replyToMember(name)}
                  >
                    <Reply className="size-3" aria-hidden="true" />
                    {chatStrings.reply}
                  </Button>
                )}
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
