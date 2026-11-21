import { ServerEvent, ClientEvent } from '@scalesquad/shared';
export class WsClient {
  private socket: WebSocket | null = null;
  private state: 'idle' | 'connecting' | 'connected' | 'waiting' | 'closed' = 'idle';
  private attempt = 0;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  constructor(
    private readonly url: string,
    private readonly receive: (event: ServerEvent) => void,
    private readonly status: (state: 'connected' | 'reconnecting' | 'offline') => void,
    private readonly factory = (url: string) => new WebSocket(url),
    private readonly random = () => Math.random(),
  ) {}
  connect() {
    if (this.state === 'connecting' || this.state === 'connected') return;
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    this.state = 'connecting';
    let socket: WebSocket;
    try {
      socket = this.factory(this.url);
    } catch {
      this.reconnect();
      return;
    }
    this.socket = socket;
    const owns = () => this.socket === socket && this.state !== 'closed';
    socket.onopen = () => {
      if (!owns() || this.state !== 'connecting') return;
      this.state = 'connected';
      this.attempt = 0;
      this.status('connected');
      if (!owns() || this.state !== 'connected') return;
      this.heartbeat = setInterval(() => {
        this.send({ v: 1, type: 'ping', id: crypto.randomUUID(), payload: {} });
      }, 20000);
    };
    socket.onmessage = (event) => {
      if (!owns()) return;
      try {
        const parsed = ServerEvent.safeParse(JSON.parse(String(event.data)) as unknown);
        if (parsed.success) this.receive(parsed.data);
      } catch {
        /* Ignore invalid messages. */
      }
    };
    socket.onerror = () => {
      if (owns()) socket.close();
    };
    socket.onclose = () => {
      if (!owns()) return;
      this.socket = null;
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = null;
      this.reconnect();
    };
  }
  private reconnect() {
    this.state = 'waiting';
    this.status('reconnecting');
    if (this.state !== 'waiting') return;
    const ms =
      Math.min(30000, 500 * 2 ** Math.min(this.attempt++, 6)) * (0.8 + 0.4 * this.random());
    this.retry = setTimeout(() => {
      this.retry = null;
      this.connect();
    }, ms);
  }
  send(event: ClientEvent) {
    if (this.socket?.readyState === 1) this.socket.send(JSON.stringify(ClientEvent.parse(event)));
  }
  close() {
    if (this.state === 'closed') return;
    this.state = 'closed';
    if (this.retry) clearTimeout(this.retry);
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.retry = null;
    this.heartbeat = null;
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.status('offline');
  }
}
