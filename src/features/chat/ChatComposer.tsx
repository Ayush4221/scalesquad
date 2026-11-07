'use client';
import type { RefObject } from 'react';
import { ArrowUp, LoaderCircle, LockKeyhole, NotebookText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CHAT_MESSAGE_MAX_LENGTH } from '@/constants/chat';
import type { ChatReply } from './ChatMessages';
export function ChatComposer({
  text,
  onChange,
  onSend,
  ready,
  sending,
  error,
  onClues,
  reply,
  onCancelReply,
  inputRef,
}: {
  text: string;
  onChange: (text: string) => void;
  onSend: () => void;
  ready: boolean;
  sending: boolean;
  error: string;
  onClues: () => void;
  reply: ChatReply | null;
  onCancelReply: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div className="space-y-3">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
        className="rounded-xl border border-border bg-background p-3 focus-within:border-ring"
      >
        {reply && (
          <div className="mb-3 flex items-start justify-between gap-3 border-l-2 border-secondary pl-3 text-xs">
            <div className="min-w-0">
              <p className="font-medium">Replying to {reply.name}</p>
              <p className="mt-1 line-clamp-2 break-words text-muted-foreground">{reply.text}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11 transition-none"
              onClick={onCancelReply}
              aria-label="Cancel reply"
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        )}
        <label htmlFor="squad-message" className="sr-only">
          Message your squad
        </label>
        <textarea
          ref={inputRef}
          id="squad-message"
          value={text}
          onChange={(event) => onChange(event.target.value)}
          maxLength={CHAT_MESSAGE_MAX_LENGTH}
          placeholder="What should your squad know?"
          disabled={!ready || sending}
          aria-describedby="chat-privacy"
          className="block min-h-24 w-full resize-y rounded bg-transparent p-1 text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:text-sm"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 px-1 text-xs text-muted-foreground transition-none"
            onClick={onClues}
          >
            <NotebookText aria-hidden="true" />
            Choose a clue
          </Button>
          <Button
            type="submit"
            className="min-h-11 w-24 transition-transform active:scale-95 motion-reduce:transform-none motion-reduce:transition-none"
            disabled={!ready || sending || !text.trim()}
            aria-busy={sending}
          >
            {sending ? (
              <>
                <LoaderCircle
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                Sending
              </>
            ) : (
              <>
                Send
                <ArrowUp aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p
        id="chat-privacy"
        className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"
      >
        <LockKeyhole className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        Evidence stays private until you choose to share it.
      </p>
    </div>
  );
}
