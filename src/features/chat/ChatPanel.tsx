'use client';
// Hallmark v2: app screen; ScaleSquad brand; signature: three roles, one deliberate conversation.
// BETA is the owner's requested voice label. Voice transport remains coming soon.
import { useEffect, useRef, useState } from 'react';
import { MessagesSquare, LockKeyhole, RefreshCw } from 'lucide-react';
import type { EvidenceCard } from '@scalesquad/shared';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CHAT_MESSAGE_MAX_LENGTH } from '@/constants/chat';
import { ChatRoster } from './ChatRoster';
import { ChatMessages, type ChatReply } from './ChatMessages';
import { ChatComposer } from './ChatComposer';
import { ChatClues } from './ChatClues';
import { VoiceChannel } from './VoiceChannel';
import { useSquadChat } from './useSquadChat';
import type { ChatDraft, ChatMember } from './types';

export function ChatPanel({
  matchId,
  available,
  members = [],
  cards = [],
  userId,
  draft,
  onIncoming,
  showRoster = true,
}: {
  matchId: string;
  available: boolean;
  members?: ChatMember[];
  cards?: EvidenceCard[];
  userId?: string;
  draft?: ChatDraft;
  onIncoming?: () => void;
  showRoster?: boolean;
}) {
  const chat = useSquadChat(matchId, available, draft, onIncoming);
  const [section, setSection] = useState<'squad' | 'clues'>('squad');
  const [reply, setReply] = useState<ChatReply | null>(null);
  const [feedback, setFeedback] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (draft) {
      setSection('squad');
      setReply(null);
      setFeedback('Clue added to draft. Review it before sending.');
    }
  }, [draft]);
  useEffect(() => {
    setReply(null);
    setSection('squad');
    setFeedback('');
  }, [matchId]);
  function draftClue(text: string) {
    setReply(null);
    chat.setText(text.slice(0, CHAT_MESSAGE_MAX_LENGTH));
    setSection('squad');
    setFeedback('Clue added to draft. Review it before sending.');
  }
  function mention(name: string) {
    setSection('squad');
    chat.setText((value) =>
      (value + (value ? ' ' : '') + `@${name} `).slice(0, CHAT_MESSAGE_MAX_LENGTH),
    );
    setFeedback('Mention added to your draft.');
  }
  async function send() {
    if (await chat.send()) {
      setReply(null);
      setFeedback('');
    }
  }
  return (
    <Card
      className="chat-card min-w-0 gap-5 overflow-clip lg:sticky lg:top-6"
      aria-label="Squad Desk"
    >
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Squad Desk</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Three perspectives. One repair.</p>
          </div>
          <div className="text-right text-xs">
            <p className="text-muted-foreground">Nexconn chat</p>
            <p role="status" className="mt-1 text-foreground">
              {chat.status === 'Unavailable'
                ? 'Chat unavailable. You can still play.'
                : chat.status}
            </p>
          </div>
        </div>
        {showRoster && (
          <ChatRoster members={members} {...(userId ? { userId } : {})} onMention={mention} />
        )}
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Squad Desk sections">
          <Button
            variant={section === 'squad' ? 'secondary' : 'ghost'}
            className="min-h-11 transition-none"
            aria-pressed={section === 'squad'}
            onClick={() => setSection('squad')}
          >
            <MessagesSquare aria-hidden="true" />
            Squad channel
          </Button>
          <Button
            variant={section === 'clues' ? 'secondary' : 'ghost'}
            className="min-h-11 transition-none"
            aria-pressed={section === 'clues'}
            onClick={() => setSection('clues')}
          >
            <LockKeyhole aria-hidden="true" />
            My clues
          </Button>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 space-y-5">
        {section === 'clues' ? (
          <ChatClues cards={cards} onDraft={draftClue} />
        ) : (
          <>
            {chat.status === 'Connecting' ? (
              <div className="min-h-40 space-y-4 py-4" aria-label="Loading conversation">
                <p className="text-sm text-muted-foreground">Connecting your squad…</p>
                <div className="h-8 w-3/4 rounded bg-muted" />
                <div className="h-8 w-1/2 rounded bg-muted" />
              </div>
            ) : (
              <ChatMessages
                messages={chat.messages}
                members={members}
                onReply={(value) => {
                  setReply(value);
                  chat.setText(`> ${value.name}: ${value.text.slice(0, 240)}\n\n`);
                  inputRef.current?.focus();
                }}
              />
            )}
            {chat.status === 'Unavailable' && available && (
              <Button
                variant="outline"
                className="min-h-11 transition-none"
                onClick={chat.reconnect}
              >
                <RefreshCw aria-hidden="true" />
                Reconnect chat
              </Button>
            )}
            <ChatComposer
              text={chat.text}
              onChange={chat.setText}
              onSend={() => void send()}
              ready={chat.ready}
              sending={chat.sending}
              error={chat.sendError}
              onClues={() => setSection('clues')}
              reply={reply}
              onCancelReply={() => {
                if (reply) {
                  const prefix = `> ${reply.name}: ${reply.text.slice(0, 240)}\n\n`;
                  chat.setText((value) =>
                    value.startsWith(prefix) ? value.slice(prefix.length) : value,
                  );
                }
                setReply(null);
              }}
              inputRef={inputRef}
            />
            {feedback && (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {feedback}
              </p>
            )}
          </>
        )}
        <VoiceChannel />
      </CardContent>
    </Card>
  );
}
