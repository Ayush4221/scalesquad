'use client';
import { lobbyStrings } from '@/constants/strings/lobby';

import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from '../../utils/validation';
import { EvidenceCard, PublicMatchView } from '@scalesquad/shared';
import { api } from '@/lib/api/client';
import { clientErrorMessage } from '@/lib/api/errors';
import { WsClient } from '@/lib/ws/client';
interface MatchLifetime {
  id: string;
  controller: AbortController;
  revision: number;
  evidenceRequest: number;
  command: string | null;
}
export function useMatch(matchId: string) {
  const [view, setView] = useState<PublicMatchView | null>(null),
    [cards, setCards] = useState<EvidenceCard[]>([]),
    [connection, setConnection] = useState<'connected' | 'reconnecting' | 'offline'>('offline'),
    [error, setError] = useState(''),
    [pendingAction, setPendingAction] = useState<string | null>(null);
  const lifetime = useRef<MatchLifetime | null>(null);
  const base = `/matches/${matchId}`;
  const owns = useCallback(
    (owner: MatchLifetime) => lifetime.current === owner && !owner.controller.signal.aborted,
    [],
  );
  const accept = useCallback(
    (next: PublicMatchView, owner: MatchLifetime) => {
      if (!owns(owner) || next.id !== owner.id || next.revision < owner.revision) return;
      if (next.revision > owner.revision) setError('');
      owner.revision = next.revision;
      setView(next);
    },
    [owns],
  );
  const refresh = useCallback(
    async (owner: MatchLifetime) => {
      const next = PublicMatchView.parse(
        await api(base, undefined, { signal: owner.controller.signal }),
      );
      accept(next, owner);
    },
    [accept, base],
  );
  const evidence = useCallback(
    async (owner: MatchLifetime) => {
      const request = ++owner.evidenceRequest;
      try {
        const next = z
          .array(EvidenceCard)
          .parse(await api(`${base}/evidence`, undefined, { signal: owner.controller.signal }));
        if (owns(owner) && request === owner.evidenceRequest) setCards(next);
      } catch {
        if (owns(owner) && request === owner.evidenceRequest)
          setError(lobbyStrings.couldNotLoadPrivateEvidence);
      }
    },
    [base, owns],
  );
  useEffect(() => {
    const owner: MatchLifetime = {
      id: matchId,
      controller: new AbortController(),
      revision: -1,
      evidenceRequest: 0,
      command: null,
    };
    lifetime.current = owner;
    setView(null);
    setCards([]);
    setError('');
    setPendingAction(null);
    setConnection('offline');
    void refresh(owner).catch((e) => {
      if (owns(owner) && owner.revision < 0)
        setError(clientErrorMessage(e, lobbyStrings.cannotLoadMatch));
    });
    const url = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
    const client = new WsClient(
      url,
      (event) => {
        if (!owns(owner)) return;
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
        if (event.type === 'match.snapshot') accept(event.payload, owner);
        if (event.type === 'evidence.available') void evidence(owner);
        if (event.type === 'error') setError(clientErrorMessage(new Error(event.payload.message)));
        if (event.type === 'run.completed' && event.payload.matchId === owner.id)
          void refresh(owner).catch(() => {});
      },
      (state) => {
        if (owns(owner)) setConnection(state);
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
      owner.controller.abort();
      if (lifetime.current === owner) lifetime.current = null;
      client.close();
      document.removeEventListener('visibilitychange', visible);
    };
  }, [matchId, refresh, evidence, accept, owns]);
  useEffect(() => {
    const owner = lifetime.current;
    if (owner && view?.id === owner.id && view.phase !== 'LOBBY') void evidence(owner);
  }, [view?.phase, view?.id, evidence, owns]);
  async function action(path: string, body: unknown = {}, reload = true) {
    const owner = lifetime.current;
    if (!owner || owner.id !== matchId || !owns(owner) || owner.command !== null) return false;
    owner.command = path;
    setPendingAction(path);
    setError('');
    try {
      await api(`${base}${path}`, body, { signal: owner.controller.signal });
      if (!owns(owner)) return false;
      // A committed command stays successful even when its follow-up read fails.
      if (reload)
        await refresh(owner).catch(() => {
          if (owns(owner)) setError(lobbyStrings.savedSyncPending);
        });
      return owns(owner);
    } catch (e) {
      if (!owns(owner)) return false;
      await refresh(owner).catch(() => {});
      if (owns(owner)) setError(clientErrorMessage(e, lobbyStrings.requestFailed));
      return false;
    } finally {
      owner.command = null;
      if (owns(owner)) setPendingAction(null);
    }
  }
  return {
    view: view?.id === matchId ? view : null,
    cards: view?.id === matchId ? cards : [],
    connection,
    error,
    pendingAction,
    busy: pendingAction !== null,
    action,
    setError,
  };
}
