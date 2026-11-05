import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { ServerEvent } from '@scalesquad/shared';
export interface Peer {
  socket: WebSocket;
  userId: string;
  room: string | null;
  alive: boolean;
  sessionToken: string;
  authorize: () => Promise<boolean>;
  foreground: boolean;
}
export class Rooms {
  readonly peers = new Set<Peer>();
  constructor(
    private readonly isMember: (userId: string, matchId: string) => Promise<boolean> = async () =>
      false,
  ) {}
  private send(peer: Peer, event: Omit<ServerEvent, 'id' | 'v'>) {
    const parsed = ServerEvent.parse({ ...event, v: 1, id: randomUUID() });
    if (peer.socket.readyState === WebSocket.OPEN) peer.socket.send(JSON.stringify(parsed));
  }
  async sendAuthorized(peer: Peer, event: Omit<ServerEvent, 'id' | 'v'>) {
    if (!(await peer.authorize())) {
      peer.socket.close(1008, 'Session expired');
      return;
    }
    this.send(peer, event);
  }
  async broadcast(matchId: string, event: Omit<ServerEvent, 'id' | 'v'>) {
    for (const peer of this.peers)
      if (peer.room === matchId && (await this.isMember(peer.userId, matchId)))
        await this.sendAuthorized(peer, event);
  }
  async sendToUser(matchId: string, userId: string, event: Omit<ServerEvent, 'id' | 'v'>) {
    if (!(await this.isMember(userId, matchId))) return;
    for (const peer of this.peers)
      if (peer.room === matchId && peer.userId === userId) await this.sendAuthorized(peer, event);
  }
  connected(matchId: string, userId: string) {
    return [...this.peers].some((p) => p.room === matchId && p.userId === userId);
  }
  revokeSession(token: string) {
    for (const peer of this.peers)
      if (peer.sessionToken === token) peer.socket.close(1008, 'Session revoked');
  }
  revokeUser(userId: string, exceptToken?: string) {
    for (const peer of this.peers)
      if (peer.userId === userId && peer.sessionToken !== exceptToken)
        peer.socket.close(1008, 'Session revoked');
  }
  foregroundConnected(userId: string) {
    return [...this.peers].some(
      (peer) =>
        peer.userId === userId && peer.foreground && peer.socket.readyState === WebSocket.OPEN,
    );
  }
}
