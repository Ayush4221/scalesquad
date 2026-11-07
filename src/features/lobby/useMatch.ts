'use client';
import { lobbyStrings } from '@/constants/strings/lobby';

import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from '../../utils/validation';
import { EvidenceCard, PublicMatchView } from '@scalesquad/shared';
import { api } from '@/lib/api/client';
import { clientErrorMessage } from '@/lib/api/errors';
import { WsClient } from '@/lib/ws/client';
export function useMatch(matchId: string) {
  const [view, setView] = useState<PublicMatchView | null>(null),
    [cards, setCards] = useState<EvidenceCard[]>([]),
    [connection, setConnection] = useState<'connected' | 'reconnecting' | 'offline'>('offline'),
    [error, setError] = useState(''),
    [pendingAction, setPendingAction] = useState<string | null>(null);
  const requestPending = useRef(false);
  const latestRevision = useRef(-1);
  const base = `/matches/${matchId}`;
  const accept = useCallback((next: PublicMatchView) => {
    if (next.revision < latestRevision.current) return;
    if (next.revision > latestRevision.current) setError('');
    latestRevision.current = next.revision;
    setView(next);
  }, []);
  const refresh = useCallback(async () => {
    accept(PublicMatchView.parse(await api(base)));
    setError('');
  }, [accept, base]);
  const evidence = useCallback(async () => {
    setCards(z.array(EvidenceCard).parse(await api(`${base}/evidence`)));
  }, [base]);
  useEffect(() => {
    let active = true;
    latestRevision.current = -1;
    setView(null);
    setCards([]);
    setError('');
    void refresh().catch((e) => {
      if (active) setError(clientErrorMessage(e, lobbyStrings.cannotLoadMatch));
    });
    const url = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
    const client = new WsClient(
      url,
      (event) => {
        if (!active) return;
        if (event.type === 'hello') {
          client.send({
            v: 1,
            type: 'presence.visibility',
            id: crypto.randomUUID(),
            payload: { foreground: document.visibilityState !== 'hidden' },
          });
          client.send({
            v: 1,
            type: 'match.subscribe',
            id: crypto.randomUUID(),
            payload: { matchId },
          });
        }
        if (event.type === 'match.snapshot') accept(event.payload);
        if (event.type === 'evidence.available')
          void evidence().catch(() => setError(lobbyStrings.couldNotLoadPrivateEvidence));
        if (event.type === 'error') setError(clientErrorMessage(new Error(event.payload.message)));
        if (event.type === 'run.completed') void refresh().catch(() => {});
      },
      (state) => {
        if (active) setConnection(state);
      },
    );
    client.connect();
    const visible = () =>
      client.send({
        v: 1,
        type: 'presence.visibility',
        id: crypto.randomUUID(),
        payload: { foreground: document.visibilityState !== 'hidden' },
      });
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      client.close();
      document.removeEventListener('visibilitychange', visible);
    };
  }, [matchId, refresh, evidence, accept]);
  useEffect(() => {
    if (view && view.phase !== 'LOBBY')
      void evidence().catch(() => setError(lobbyStrings.couldNotLoadPrivateEvidence));
  }, [view?.phase, evidence]);
  async function action(path: string, body: unknown = {}, reload = true) {
    if (requestPending.current) return false;
    requestPending.current = true;
    setPendingAction(path);
    setError('');
    try {
      await api(`${base}${path}`, body);
      if (reload) await refresh();
      return true;
    } catch (e) {
      await refresh().catch(() => {});
      setError(clientErrorMessage(e, lobbyStrings.requestFailed));
      return false;
    } finally {
      requestPending.current = false;
      setPendingAction(null);
    }
  }
  return {
    view,
    cards,
    connection,
    error,
    pendingAction,
    busy: pendingAction !== null,
    action,
    setError,
  };
}
