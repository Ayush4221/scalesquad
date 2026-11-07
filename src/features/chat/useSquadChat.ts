'use client';
import { chatStrings } from '@/constants/strings/chat';

import { useEffect, useRef, useState } from 'react';
import { z } from '../../utils/validation';
import { api } from '@/lib/api/client';
import type { ChatClient, ChatMessage } from '@/lib/nexconn/client';
import { CHAT_HISTORY_LIMIT, CHAT_MESSAGE_MAX_LENGTH } from '@/constants/chat';
import type { ChatDraft } from './types';

export function useSquadChat(
  matchId: string,
  available: boolean,
  draft?: ChatDraft,
  onIncoming?: () => void,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'Connecting' | 'Connected' | 'Unavailable'>(
    chatStrings.connecting,
  );
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const client = useRef<ChatClient | null>(null);
  const pending = useRef(false);
  const incoming = useRef(onIncoming);
  incoming.current = onIncoming;
  useEffect(() => {
    setText('');
    setSendError('');
  }, [matchId]);
  useEffect(() => {
    if (draft) setText(draft.text.slice(0, CHAT_MESSAGE_MAX_LENGTH));
  }, [draft]);
  useEffect(() => {
    setMessages([]);
    setStatus(available ? chatStrings.connecting : chatStrings.unavailable);
    setSending(false);
    pending.current = false;
    if (!available) return;
    let stopped = false;
    let instance: ChatClient | null = null;
    void (async () => {
      const access = z
        .object({
          token: z.string(),
          appKey: z.string(),
          groupRef: z.string(),
          region: z.enum(['SG', 'NA', 'SA']),
        })
        .parse(await api('/nexconn/token', { matchId }));
      const { NexconnClient } = await import('@/lib/nexconn/client');
      if (stopped) return;
      instance = new NexconnClient();
      client.current = instance;
      await instance.connect(access, (values) => {
        if (stopped) return;
        if (values.length) incoming.current?.();
        setMessages((old) =>
          [...new Map([...old, ...values].map((message) => [message.id, message])).values()]
            .sort((a, b) => a.sentAt - b.sentAt)
            .slice(-CHAT_HISTORY_LIMIT),
        );
      });
      if (stopped) {
        await instance.close();
        return;
      }
      setStatus(chatStrings.connected);
    })().catch(() => {
      if (!stopped) setStatus(chatStrings.unavailable);
      void instance?.close().catch(() => {});
    });
    return () => {
      stopped = true;
      client.current = null;
      void instance?.close().catch(() => {});
    };
  }, [matchId, available, attempt]);
  async function send() {
    const current = client.current;
    const outgoing = text.trim();
    if (
      !current ||
      status !== chatStrings.connected ||
      pending.current ||
      !outgoing ||
      outgoing.length > CHAT_MESSAGE_MAX_LENGTH
    )
      return false;
    pending.current = true;
    setSending(true);
    setSendError('');
    try {
      await current.send(outgoing);
      if (client.current === current) setText((value) => (value.trim() === outgoing ? '' : value));
      return client.current === current;
    } catch {
      if (client.current === current) setSendError(chatStrings.messageNotSentYourDraftIs);
      return false;
    } finally {
      if (client.current === current) {
        pending.current = false;
        setSending(false);
      }
    }
  }
  return {
    messages,
    text,
    setText,
    status,
    sending,
    sendError,
    send,
    ready: available && status === chatStrings.connected,
    reconnect: () => setAttempt((value) => value + 1),
  };
}
