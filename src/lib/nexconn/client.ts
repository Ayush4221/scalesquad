import {
  AreaCode,
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
  ): Promise<void>;
  send(text: string): Promise<void>;
  close(): Promise<void>;
}
let initialized = false;
export class NexconnClient implements ChatClient {
  private channel: GroupChannel | null = null;
  private receive: ((messages: ChatMessage[]) => void) | null = null;
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
    this.channel = new GroupChannel(access.groupRef);
    NCEngine.addMessageHandler(
      this.handlerId,
      new MessageHandler({
        onMessageReceived: ({ messages }) => {
          receive(this.map(messages));
        },
      }),
    );
    const result = await NCEngine.connect({ token: access.token });
    if (result.code !== 0) throw new Error('Chat connection failed');
    const history = await BaseChannel.createMessagesQuery({
      channelIdentifier: this.channel.identifier,
      pageSize: 50,
      startTime: Date.now(),
      isAscending: false,
    }).loadNextPage();
    if (history.code === 0 && history.data) receive(this.map(history.data.data));
  }
  async send(text: string) {
    if (!this.channel || !text.trim() || text.length > 2000)
      throw new Error('Invalid chat message');
    const result = await this.channel.sendMessage(new SendTextMessageParams({ text: text.trim() }));
    if (result.code !== 0) throw new Error('Message not sent');
    if (result.data) this.receive?.(this.map([result.data]));
  }
  async close() {
    NCEngine.removeMessageHandler(this.handlerId);
    await NCEngine.disconnect();
    this.channel = null;
    this.receive = null;
  }
}
