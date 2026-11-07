import { describe, it, expect } from 'vitest';
import { MatchPhase as DbPhase, Role as DbRole } from '@prisma/client';
import { MatchPhase, Role } from '@scalesquad/shared';
describe('database contract', () => {
  it('generated enums match domain contracts', () => {
    expect(Object.values(DbPhase)).toEqual(MatchPhase.options);
    expect(Object.values(DbRole)).toEqual(Role.options);
  });
});
