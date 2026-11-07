import type { ClientEvent } from '@scalesquad/shared';
import type { GameServices } from './gameController';
export function createWsController(s: GameServices) {
  return async (userId: string, event: ClientEvent) => {
    switch (event.type) {
      case 'ping':
      case 'presence.visibility':
        return;
      case 'match.subscribe':
        return s.match.getPublicView(userId, event.payload.matchId);
      case 'player.ready':
        return s.match.setReady(userId, event.payload.matchId, event.payload.ready);
      case 'brief.ack':
        return s.match.acknowledge(userId, event.payload.matchId);
      case 'lock.pass':
        return s.lock.passControl(userId, event.payload.matchId, event.payload.targetUserId);
      case 'lock.reclaim':
        return s.lock.reclaim(userId, event.payload.matchId);
      case 'config.update':
        return s.config.update(
          userId,
          event.payload.matchId,
          event.payload.change,
          event.payload.expectedVersion,
        );
      case 'run.start':
        return s.run.start(userId, event.payload.matchId, event.payload.runNumber);
    }
  };
}
