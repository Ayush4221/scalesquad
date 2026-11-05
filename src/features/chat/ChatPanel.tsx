'use client';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { contentHash } from '@scalesquad/shared';
import { api } from '@/lib/api/client';
import type { ChatClient, ChatMessage } from '@/lib/nexconn/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
export function ChatPanel({
  matchId,
  available,
  members = [],
  draft,
  onIncoming,
}: {
  matchId: string;
  available: boolean;
  members?: { userId: string; name: string }[];
  draft?: { text: string; id: number };
  onIncoming?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [text, setText] = useState(''),
    [status, setStatus] = useState('Connecting'),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const client = useRef<ChatClient | null>(null);
  const incoming = useRef(onIncoming);
  incoming.current = onIncoming;
  useEffect(() => {
    if (draft) setText(draft.text.slice(0, 2000));
  }, [draft]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () =>
      document.documentElement.style.setProperty(
        '--keyboard-height',
        `${viewport?.height ?? window.innerHeight}px`,
      );
    resize();
    viewport?.addEventListener('resize', resize);
    return () => viewport?.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
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
      await instance.connect(access, (incoming) => {
        if (!stopped && incoming.length > 0) notifyIncoming();
        if (!stopped)
          setMessages((old) =>
            [...new Map([...old, ...incoming].map((m) => [m.id, m])).values()]
              .sort((a, b) => a.sentAt - b.sentAt)
              .slice(-100),
          );
      });
      if (stopped) {
        await instance.close();
        return;
      }
      setStatus('Connected');
      setReady(true);
    })().catch(() => {
      if (!stopped) {
        setStatus('Chat unavailable. You can still play.');
        setReady(false);
      }
    });
    function notifyIncoming() {
      incoming.current?.();
    }
    return () => {
      stopped = true;
      client.current = null;
      void instance?.close();
    };
  }, [matchId, available]);
  async function send() {
    if (!client.current) return;
    setBusy(true);
    try {
      await client.current.send(text);
      setText('');
      setStatus('Connected');
    } catch {
      setStatus('Message not sent. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="chat-card">
      <CardHeader>
        <CardTitle>Squad channel</CardTitle>
        <p role="status" className="muted text-sm">
          {available ? status : 'Chat unavailable. Configure Nexconn to connect your squad.'}
        </p>
      </CardHeader>
      <CardContent>
        <div className="chat-messages" aria-live="polite">
          {messages.length === 0 ? (
            <p className="muted">Share the facts that could change your squad’s decision.</p>
          ) : (
            messages.map((m) => (
              <div className="chat-message" key={m.id}>
                <strong>
                  {m.sender === 'scalesquadsystem'
                    ? 'ScaleSquad'
                    : (members.find((u) => `u${contentHash(u.userId).slice(0, 48)}` === m.sender)
                        ?.name ?? 'Squad member')}
                </strong>
                <p>{m.text}</p>
              </div>
            ))
          )}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Input
            aria-label="Message your squad"
            placeholder="Share with squad…"
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            disabled={!ready || busy}
          />
          <Button type="submit" disabled={!ready || busy || !text.trim()}>
            Send
          </Button>
        </form>
        <p className="muted mt-3 text-xs">Evidence stays private until you choose to share it.</p>
      </CardContent>
    </Card>
  );
}
