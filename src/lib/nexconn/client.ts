import { networkStrings } from '@/constants/strings/network';
import { CHAT_MESSAGE_MAX_LENGTH } from '@/constants/chat';
import {
  AreaCode,
  ConnectionStatus,
  ConnectionStatusHandler,
  BaseChannel,
  GroupChannel,
  LogLevel,
  MessageHandler,
  NCEngine,
  SendTextMessageParams,
  type Message,
} from '@nexconn/chat';
export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  sentAt: number;
}
export interface ChatClient {
  connect(
    access: { token: string; appKey: string; groupRef: string; region: 'SG' | 'NA' | 'SA' },
    receive: (messages: ChatMessage[]) => void,
    status?: (state: ChatConnectionState) => void,
  ): Promise<void>;
  send(text: string): Promise<void>;
  close(): Promise<void>;
}
export type ChatConnectionState = 'connecting' | 'connected' | 'unavailable';
let initialized = false;
const engine: { owner: NexconnClient | null } = { owner: null };
let lifecycle = Promise.resolve();
function sequence(task: () => Promise<void>): Promise<void> {
  const next = lifecycle.then(task);
  lifecycle = next.catch(() => {});
  return next;
}
export class NexconnClient implements ChatClient {
  private closed = false;
  private channel: GroupChannel | null = null;
  private receive: ((messages: ChatMessage[]) => void) | null = null;
  private status: ((state: ChatConnectionState) => void) | undefined;
  private readonly handlerId = crypto.randomUUID();
  private map(messages: Message<object>[]): ChatMessage[] {
    return messages
      .filter(
        (m) =>
          m.channelIdentifier.channelId === this.channel?.identifier.channelId &&
          'text' in m.content &&
          typeof m.content.text === 'string',
      )
      .map((m) => ({
        id: m.messageId,
        sender: m.senderUserId,
        text: 'text' in m.content ? String(m.content.text) : '',
        sentAt: m.sentTime,
      }));
  }
  async connect(
    access: { token: string; appKey: string; groupRef: string; region: 'SG' | 'NA' | 'SA' },
    receive: (messages: ChatMessage[]) => void,
    status?: (state: ChatConnectionState) => void,
  ) {
    return sequence(async () => {
      if (this.closed) return;
      // Nexconn owns one engine per page. An old component's cleanup must never
      // disconnect the engine after a newer component has connected.
      if (engine.owner && engine.owner !== this) await engine.owner.disconnect();
      if (this.closed) return;
      engine.owner = this;
      try {
        await this.open(access, receive, status);
        if (this.closed) await this.disconnect();
      } catch (error) {
        await this.disconnect();
        throw error;
      }
    });
  }
  private async open(
    access: { token: string; appKey: string; groupRef: string; region: 'SG' | 'NA' | 'SA' },
    receive: (messages: ChatMessage[]) => void,
    status?: (state: ChatConnectionState) => void,
  ) {
    if (!initialized) {
      NCEngine.initialize({
        appKey: access.appKey,
        areaCode: AreaCode[access.region],
        logLevel: LogLevel.ERROR,
      });
      initialized = true;
    }
    this.receive = receive;
    this.status = status;
    this.channel = new GroupChannel(access.groupRef);
    let observed = false;
    NCEngine.addConnectionStatusHandler(
      this.handlerId,
      new ConnectionStatusHandler({
        onConnectionStatusChanged: ({ status: next }) => {
          if (this.closed || engine.owner !== this) return;
          observed = true;
          status?.(
            next === ConnectionStatus.CONNECTED
              ? 'connected'
              : next === ConnectionStatus.CONNECTING || next === ConnectionStatus.SUSPENDED
                ? 'connecting'
                : 'unavailable',
          );
        },
      }),
    );
    NCEngine.addMessageHandler(
      this.handlerId,
      new MessageHandler({
        onMessageReceived: ({ messages }) => {
          if (!this.closed && engine.owner === this) receive(this.map(messages));
        },
      }),
    );
    const result = await NCEngine.connect({ token: access.token });
    if (result.code !== 0) throw new Error(networkStrings.chatConnectionFailed);
    if (this.closed) return;
    if (!observed) status?.('connected');
    const history = await BaseChannel.createMessagesQuery({
      channelIdentifier: this.channel.identifier,
      pageSize: 50,
      startTime: Date.now(),
      isAscending: false,
    }).loadNextPage();
    if (!this.closed && history.code === 0 && history.data) receive(this.map(history.data.data));
  }
  async send(text: string) {
    if (
      this.closed ||
      engine.owner !== this ||
      !this.channel ||
      !text.trim() ||
      text.length > CHAT_MESSAGE_MAX_LENGTH
    )
      throw new Error(networkStrings.invalidChatMessage);
    const result = await this.channel.sendMessage(new SendTextMessageParams({ text: text.trim() }));
    if (result.code !== 0) throw new Error(networkStrings.messageNotSent);
    if (result.data) this.receive?.(this.map([result.data]));
  }
  async close() {
    this.closed = true;
    return sequence(() => this.disconnect());
  }
  private async disconnect() {
    if (engine.owner !== this) return;
    const status = this.status;
    this.channel = null;
    this.receive = null;
    this.status = undefined;
    engine.owner = null;
    status?.('unavailable');
    try {
      NCEngine.removeMessageHandler(this.handlerId);
    } finally {
      try {
        NCEngine.removeConnectionStatusHandler(this.handlerId);
      } finally {
        await NCEngine.disconnect();
      }
    }
  }
}
