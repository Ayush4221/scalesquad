import { ServerEvent, ClientEvent } from '@scalesquad/shared';
export class WsClient {
  private socket: WebSocket | null = null;
  private closed = false;
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
    this.closed = false;
    const socket = this.factory(this.url);
    this.socket = socket;
    socket.onopen = () => {
      this.attempt = 0;
      this.status('connected');
      this.heartbeat = setInterval(() => {
        this.send({ v: 1, type: 'ping', id: crypto.randomUUID(), payload: {} });
      }, 20000);
    };
    socket.onmessage = (event) => {
      try {
        const parsed = ServerEvent.safeParse(JSON.parse(String(event.data)) as unknown);
        if (parsed.success) this.receive(parsed.data);
      } catch {
        /* Ignore invalid messages. */
      }
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = null;
      if (this.closed) return;
      this.status('reconnecting');
      const ms =
        Math.min(30000, 500 * 2 ** Math.min(this.attempt++, 6)) * (0.8 + 0.4 * this.random());
      this.retry = setTimeout(() => this.connect(), ms);
    };
  }
  send(event: ClientEvent) {
    if (this.socket?.readyState === 1) this.socket.send(JSON.stringify(ClientEvent.parse(event)));
  }
  close() {
    this.closed = true;
    if (this.retry) clearTimeout(this.retry);
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.socket?.close();
    this.status('offline');
  }
}
