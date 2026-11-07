import { createHash, randomBytes } from 'node:crypto';
import { z } from '../utils/validation';
import { AppError, contentHash } from '@scalesquad/shared';
import type { ChatProvider } from './index';
const response = z.object({ code: z.number(), result: z.unknown().optional() });
const tokenResult = z.object({ accessToken: z.string().min(1).max(512), userId: z.string() });
const domains = {
  SG: ['api.sg-light-api.com', 'api-b.sg-light-api.com'],
  NA: ['api.us-light-api.com', 'api-b.us-light-api.com'],
  SA: ['api.sau-light-api.com', 'api-b.sau-light-api.com'],
} as const;
export const chatUserId = (userId: string) => `u${contentHash(userId).slice(0, 48)}`;
export class NexconnChatProvider implements ChatProvider {
  readonly available = true;
  private readonly systemUser = 'scalesquadsystem';
  constructor(
    private readonly appKey: string,
    private readonly secret: string,
    private readonly region: 'SG' | 'NA' | 'SA' = 'SG',
    private readonly request: typeof fetch = fetch,
  ) {}
  private async call(path: string, body: unknown, retry = true): Promise<unknown> {
    for (let attempt = 0; attempt < (retry ? 2 : 1); attempt++) {
      const nonce = randomBytes(8).toString('hex'),
        timestamp = String(Date.now());
      const signature = createHash('sha1')
        .update(this.secret + nonce + timestamp)
        .digest('hex');
      try {
        const result = await this.request(
          `https://${domains[this.region][attempt] ?? domains[this.region][0]}${path}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'App-Key': this.appKey,
              Nonce: nonce,
              Timestamp: timestamp,
              Signature: signature,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(5000),
          },
        );
        if (!result.ok) throw new Error('Upstream rejected');
        const parsed = response.parse(await result.json());
        if (parsed.code !== 0)
          throw new AppError('UPSTREAM_UNAVAILABLE', 503, 'Chat is unavailable');
        return parsed.result;
      } catch (error) {
        if (error instanceof AppError || attempt === (retry ? 1 : 0))
          throw new AppError('UPSTREAM_UNAVAILABLE', 503, 'Chat is unavailable');
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
      }
    }
    throw new AppError('UPSTREAM_UNAVAILABLE', 503, 'Chat is unavailable');
  }
  private async register(userId: string) {
    return tokenResult.parse(
      await this.call('/v4/auth/access-token/issue', {
        userId,
        name: userId === this.systemUser ? 'ScaleSquad' : 'Squad member',
      }),
    );
  }
  async createGroup(matchId: string, members: string[]) {
    const channelId = `m${contentHash(matchId).slice(0, 48)}`;
    await this.register(this.systemUser);
    for (const id of members) await this.register(chatUserId(id));
    try {
      await this.call(
        '/v4/group-channel/create',
        {
          channelId,
          name: 'ScaleSquad',
          owner: this.systemUser,
          userIds: members.map(chatUserId),
          permissions: {
            joinPerm: 3,
            memInvitePerm: 0,
            removePerm: 0,
            profilePerm: 0,
            memProfilePerm: 2,
          },
        },
        false,
      );
    } catch (error) {
      await this.deleteGroup(channelId).catch(() => {});
      throw error;
    }
    return channelId;
  }
  async addMember(groupRef: string, userId: string) {
    await this.register(chatUserId(userId));
    await this.call('/v4/group-channel/join', {
      channelId: groupRef,
      userIds: [chatUserId(userId)],
    });
  }
  async removeMember(groupRef: string, userId: string) {
    await this.call('/v4/group-channel/leave', {
      channelId: groupRef,
      userIds: [chatUserId(userId)],
    });
  }
  async deleteGroup(groupRef: string) {
    await this.call('/v4/group-channel/dismiss', { channelId: groupRef });
  }
  async mintUserToken(userId: string) {
    const result = await this.register(chatUserId(userId));
    return { token: result.accessToken, appKey: this.appKey, region: this.region };
  }
  async sendSystemNotice(groupRef: string, notice: string) {
    await this.call(
      '/v4/group-channel/message/send',
      {
        fromUserId: this.systemUser,
        toChannelIds: [groupRef],
        messageType: 'RC:TxtMsg',
        content: JSON.stringify({ content: notice }),
        isEchoToSender: 1,
        shouldPersist: 1,
        disablePush: true,
      },
      false,
    );
  }
}
