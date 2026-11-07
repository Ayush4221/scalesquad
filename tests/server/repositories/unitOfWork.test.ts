import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@scalesquad/db';
import { AppError } from '@scalesquad/shared';
import { withTransaction } from '../../../src/server/repositories/unitOfWork';

afterEach(() => vi.useRealTimers());

describe('transaction conflict recovery', () => {
  it('waits before retrying aborted transactions and returns the successful result', async () => {
    vi.useFakeTimers();
    const transaction = vi
      .fn()
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockResolvedValue('saved');
    const client = { $transaction: transaction } as unknown as PrismaClient;
    const result = withTransaction(async () => 'saved', client);
    await Promise.resolve();
    expect(transaction).toHaveBeenCalledTimes(1);
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe('saved');
    expect(transaction).toHaveBeenCalledTimes(3);
    expect(transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
      timeout: 10000,
    });
  });

  it('stops retrying persistent conflicts and preserves the safe conflict response', async () => {
    vi.useFakeTimers();
    const transaction = vi.fn().mockRejectedValue({ code: 'P2034' });
    const client = { $transaction: transaction } as unknown as PrismaClient;
    const result = expect(withTransaction(async () => {}, client)).rejects.toMatchObject({
      code: 'VERSION_CONFLICT',
      httpStatus: 409,
    });
    await vi.runAllTimersAsync();
    await result;
    expect(transaction).toHaveBeenCalledTimes(5);
  });

  it.each([
    new AppError('VERSION_CONFLICT', 409),
    new AppError('FORBIDDEN', 403),
    new Error('database unavailable'),
  ])(
    'does not retry application conflicts, authorization errors or unrelated errors',
    async (error) => {
      const transaction = vi.fn().mockRejectedValue(error);
      const client = { $transaction: transaction } as unknown as PrismaClient;
      await expect(withTransaction(async () => {}, client)).rejects.toBe(error);
      expect(transaction).toHaveBeenCalledTimes(1);
    },
  );

  it('does not retry uniqueness violations', async () => {
    const transaction = vi.fn().mockRejectedValue({ code: 'P2002' });
    const client = { $transaction: transaction } as unknown as PrismaClient;
    await expect(withTransaction(async () => {}, client)).rejects.toMatchObject({
      code: 'VERSION_CONFLICT',
      httpStatus: 409,
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
