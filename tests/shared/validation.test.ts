import { expect, it, vi } from 'vitest';
import { z } from '../../src/utils/validation';

it('constructs and parses schemas without probing dynamic code under a strict CSP', () => {
  const evaluate = vi.spyOn(globalThis, 'Function').mockImplementation(() => {
    throw new Error('CSP prohibits eval');
  });
  try {
    const schema = z.object({ id: z.string(), count: z.number() }).strict();
    expect(schema.parse({ id: 'match', count: 3 })).toEqual({ id: 'match', count: 3 });
    expect(schema.safeParse({ id: 1, count: 3 }).success).toBe(false);
    expect(evaluate).not.toHaveBeenCalled();
  } finally {
    evaluate.mockRestore();
  }
});
