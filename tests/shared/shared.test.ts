import { describe, it, expect } from 'vitest';
import {
  AppError,
  canonicalize,
  contentHash,
  ConfigurationValues,
  ClientEvent,
  ServerEvent,
  parse,
  requireUser,
} from '../../src/shared/index';
describe('canonical JSON and contracts', () => {
  it('sorts nested keys, preserves arrays and has a golden SHA256', () => {
    expect(canonicalize({ b: [2, 1], a: { z: true, c: null } })).toBe(
      '{"a":{"c":null,"z":true},"b":[2,1]}',
    );
    expect(contentHash({ b: 2, a: 1 })).toBe(contentHash({ a: 1, b: 2 }));
    expect(contentHash('hello')).toBe(
      '5aa762ae383fbb727af3c7a36d4940a5b8c40a989452d2304fc958ff3f354e7a',
    );
    expect(contentHash([1, 2])).not.toBe(contentHash([2, 1]));
  });
  it.each([undefined, NaN, Infinity, () => {}, Symbol('x'), new Date(), new Map(), [undefined]])(
    'rejects non-JSON %s',
    (value) => {
      expect(() => canonicalize(value)).toThrow();
    },
  );
  it('rejects cycles and supports repeated references and null prototypes', () => {
    const value: { self?: unknown } = {};
    value.self = value;
    expect(() => canonicalize(value)).toThrow();
    expect(canonicalize([{}, {}])).toBe('[{},{}]');
    expect(canonicalize(Object.create(null))).toBe('{}');
  });
  it('rejects unknown fields and bad enums', () => {
    expect(ConfigurationValues.safeParse({ appCapacity: 'MAX' }).success).toBe(false);
    expect(
      ClientEvent.safeParse({ v: 1, type: 'ping', id: 'a', payload: { secret: 1 } }).success,
    ).toBe(false);
    expect(ClientEvent.safeParse({ type: 'ping', id: 'a', payload: {} }).success).toBe(false);
    expect(
      ServerEvent.safeParse({
        v: 1,
        type: 'evidence.available',
        id: 'a',
        payload: { phase: 'BRIEFING', content: 'no' },
      }).success,
    ).toBe(false);
  });
  it('safe errors never serialize cause', () => {
    const e = new AppError('INTERNAL', 500, 'Safe', { cause: new Error('private') });
    expect(JSON.stringify(e)).toBe('{"code":"INTERNAL","message":"Safe"}');
    expect(() => requireUser(null)).toThrow('Sign in again to continue.');
    expect(() => requireUser('a')).not.toThrow();
    expect(() => parse(ConfigurationValues, {})).toThrow('Invalid input');
  });
});
