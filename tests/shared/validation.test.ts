import { describe, it, expect } from 'vitest';
import {
  JoinMatchSchema,
  ReadySchema,
  ConfigUpdateSchema,
  PassControlSchema,
  StartRunSchema,
  EmptyBodySchema,
  EmptyQuerySchema,
  ChatTokenSchema,
  ClientEvent,
  parse,
} from '@scalesquad/shared';
describe('request DTO validation', () => {
  it('normalizes join codes and bounds identifiers/versions', () => {
    expect(parse(JoinMatchSchema, { code: ' abcd2345 ' })).toEqual({ code: 'ABCD2345' });
    expect(ChatTokenSchema.safeParse({ matchId: '../private' }).success).toBe(false);
    expect(
      ConfigUpdateSchema.safeParse({ change: { atomicCheckin: true }, expectedVersion: 2147483648 })
        .success,
    ).toBe(false);
    expect(ConfigUpdateSchema.safeParse({ change: {}, expectedVersion: 0 }).success).toBe(false);
    expect(ReadySchema.safeParse({ ready: 'true' }).success).toBe(false);
    expect(PassControlSchema.safeParse({ targetUserId: 'x'.repeat(81) }).success).toBe(false);
  });
  it('rejects unknown fields and forged evidence recipients', () => {
    for (const [schema, body] of [
      [EmptyBodySchema, { userId: 'other' }],
      [EmptyQuerySchema, { userId: 'other' }],
      [StartRunSchema, { runNumber: 1, configuration: {} }],
      [ConfigUpdateSchema, { change: { cacheAsAuthority: true }, expectedVersion: 0 }],
      [ChatTokenSchema, { matchId: 'match', userId: 'other' }],
    ] as const)
      expect(schema.safeParse(body).success).toBe(false);
  });
  it('HTTP and WebSocket use the same bounded configuration DTO', () => {
    const request = { change: { atomicCheckin: true }, expectedVersion: 2147483648 };
    expect(ConfigUpdateSchema.safeParse(request).success).toBe(false);
    expect(
      ClientEvent.safeParse({
        v: 1,
        id: 'request',
        type: 'config.update',
        payload: { matchId: 'match', ...request },
      }).success,
    ).toBe(false);
    expect(StartRunSchema.safeParse({ runNumber: 2 }).success).toBe(false);
  });
});
