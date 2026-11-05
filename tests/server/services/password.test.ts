import { describe, it, expect } from 'vitest';
import {
  ScryptPasswordHasher,
  validatePassword,
} from '../../../src/server/services/passwordService';
import { DUMMY_HASH } from '../../../src/server/services/authService';
import { Semaphore } from '../../../src/server/lib/semaphore';
describe('scrypt password protection', () => {
  it('applies Unicode policy without composition rules', () => {
    for (const value of ['short', 'x'.repeat(129), 'Ada walks over river stones', 'unbelievable'])
      expect(() => validatePassword(value, 'ada@example.invalid')).toThrow();
    expect(validatePassword('é'.repeat(12), 'ada@example.invalid')).toBe('é'.repeat(12));
    expect(validatePassword('e\u0301'.repeat(12), 'ada@example.invalid')).toBe('é'.repeat(12));
    expect(validatePassword('slow rivers drift in silence', 'ada@example.invalid')).toContain(' ');
  });
  it('uses random salts, valid dummy work and bounded encoded parameters', async () => {
    const h = new ScryptPasswordHasher(),
      plain = 'é lantern marble river stones',
      first = await h.hash(plain),
      second = await h.hash(plain);
    expect(first).not.toBe(second);
    expect(await h.verify(first, plain.normalize('NFD'))).toBe(true);
    expect(await h.verify(first, 'incorrect passphrase')).toBe(false);
    expect(await h.verify(DUMMY_HASH, 'ScaleSquad timing equalizer')).toBe(true);
    expect(h.needsRehash(first)).toBe(false);
    expect(h.needsRehash(first.replace('$32768$', '$16384$'))).toBe(true);
    expect(await h.verify('malformed', plain)).toBe(false);
    expect(await h.verify(first.replace('$32768$', '$99999999$'), plain)).toBe(false);
    await expect(h.hash('x'.repeat(129))).rejects.toThrow();
  }, 15000);
  it('bounds running work and queue size, releasing slots after failures', async () => {
    const gate = new Semaphore(1, 1);
    let release: () => void = () => {};
    const first = gate.run(
      () =>
        new Promise<void>((r) => {
          release = r;
        }),
    );
    const second = gate.run(async () => {
      throw new Error('failed');
    });
    await expect(gate.run(async () => {})).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    release();
    await first;
    await expect(second).rejects.toThrow('failed');
    await expect(gate.run(async () => true)).resolves.toBe(true);
  });
});
