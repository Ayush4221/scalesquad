import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma, Role as DbRole, MatchPhase as DbPhase } from '../../src/db/index';
import { Role, MatchPhase } from '@scalesquad/shared';
import { PrismaMatchRepository } from '../../src/server/repositories/matchRepository';
import {
  PrismaSessionRepository,
  PrismaUserRepository,
} from '../../src/server/repositories/sessionRepository';
import { SessionService } from '../../src/server/services/sessionService';
import { MatchService } from '../../src/server/services/matchService';
import { ConfigService } from '../../src/server/services/configService';
import { RunService } from '../../src/server/services/runService';
import { EvidenceService } from '../../src/server/services/evidenceService';
import { PrismaEvidenceRepository } from '../../src/server/repositories/evidenceRepository';
import { silentEvents } from '../../src/server/domain/ports';
import { FakeChatProvider } from '@scalesquad/nexconn/fake';
import { runSimulation } from '@scalesquad/sim';
import { loadScenario } from '@scalesquad/scenario';
import { withTransaction } from '../../src/server/repositories/unitOfWork';
import { EditLockService } from '../../src/server/services/editLockService';
import { createAuthAdapter } from '../../src/server/repositories/authRepository';
describe('isolated Postgres integration', () => {
  const prisma = getPrisma(),
    prefix = `dbtest${Date.now()}`,
    users = ['a', 'b', 'c'].map((x) => `${prefix}${x}`),
    repo = new PrismaMatchRepository(prisma);
  const clock = { now: () => Date.now() };
  const match = new MatchService(
    repo,
    new PrismaUserRepository(prisma),
    new FakeChatProvider(),
    clock,
    silentEvents,
    () => prefix,
  );
  beforeAll(async () => {
    if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.endsWith('_test'))
      throw new Error('DATABASE_URL must point to a database named *_test');
    for (const id of users)
      await prisma.user.create({ data: { id, name: id, emailVerified: new Date() } });
  });
  afterAll(async () => {
    await prisma.match.deleteMany({ where: { id: prefix } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  });
  it('enums match the shared contracts', () => {
    expect(Object.values(DbRole)).toEqual(Role.options);
    expect(Object.values(DbPhase)).toEqual(MatchPhase.options);
  });
  it('persists and completes a real match; constraints and transaction rollback hold', async () => {
    const view = await match.createMatch(users[0]!);
    for (const id of users.slice(1)) await match.joinMatch(id, view.joinCode!);
    await expect(
      prisma.matchMember.create({
        data: {
          id: `${prefix}extra`,
          matchId: prefix,
          userId: users[0]!,
          role: 'TRAFFIC',
          lastSeenAt: new Date(),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    for (const id of users) await match.setReady(id, prefix, true);
    await match.startMatch(users[0]!, prefix);
    const privateCards = new PrismaEvidenceRepository(prisma);
    const evidence = new EvidenceService(repo, privateCards);
    expect(await privateCards.listForOwner(prefix, 'unrelated')).toEqual([]);
    expect(await evidence.get(users[1]!, prefix)).toHaveLength(1);
    for (const id of users) await match.acknowledge(id, prefix);
    const lock = new EditLockService(repo, clock, silentEvents);
    const revision = (await repo.find(prefix))!.revision;
    for (let i = 0; i < 5; i++) await lock.presence(users[0]!, prefix, true);
    expect((await repo.find(prefix))!.revision).toBe(revision);
    expect(await repo.countHosted(users[0]!, 0)).toEqual({ active: 1, recent: 1 });
    expect(await repo.countMemberships(users[0]!)).toBe(1);
    expect(await repo.closeInactive(prefix, clock.now() - 1800000, clock.now())).toBe(false);
    const config = new ConfigService(repo, clock, silentEvents);
    await Promise.all([
      config.update(users[0]!, prefix, loadScenario().referenceRepair, 0),
      lock.presence(users[0]!, prefix, true),
    ]);
    const run = new RunService(repo, clock, silentEvents, async (b) => runSimulation(b));
    await run.start(users[0]!, prefix, 1);
    await match.advance(users[0]!, prefix);
    for (const id of users) await match.acknowledge(id, prefix);
    await run.start(users[0]!, prefix, 3);
    expect((await match.getPublicView(users[1]!, prefix)).comparison?.status).toBe('PASSED');
    expect(
      await prisma.configurationSnapshot.count({ where: { runs: { some: { matchId: prefix } } } }),
    ).toBe(2);
    const before = await prisma.auditLog.count({ where: { matchId: prefix } });
    await expect(
      withTransaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            id: `${prefix}rollback`,
            matchId: prefix,
            userId: users[0]!,
            action: 'rollback',
            detail: {},
          },
        });
        throw new Error('rollback');
      }, prisma),
    ).rejects.toThrow('rollback');
    expect(await prisma.auditLog.count({ where: { matchId: prefix } })).toBe(before);
    await match.advance(users[0]!, prefix);
    await repo.delete(prefix);
    const where = { matchId: prefix };
    expect(await prisma.matchMember.count({ where })).toBe(0);
    expect(await prisma.configuration.count({ where })).toBe(0);
    expect(await prisma.privateEvidence.count({ where })).toBe(0);
    expect(await prisma.simulationRun.count({ where })).toBe(0);
    expect(await prisma.editLock.count({ where })).toBe(0);
    expect(await prisma.auditLog.count({ where })).toBe(0);
  });
  it('Auth.js compatible database sessions expire and delete on logout', async () => {
    const token = `${prefix}session`;
    await prisma.session.create({
      data: { sessionToken: token, userId: users[0]!, expires: new Date(Date.now() + 60000) },
    });
    const service = new SessionService(new PrismaSessionRepository(prisma), clock);
    expect((await service.resolveFromCookie(`authjs.session-token=${token}`))?.userId).toBe(
      users[0],
    );
    await prisma.session.delete({ where: { sessionToken: token } });
    expect(await service.resolveFromCookie(`authjs.session-token=${token}`)).toBeNull();
  });
  it('OAuth account credentials are discarded before database writes', async () => {
    const adapter = createAuthAdapter(prisma);
    await adapter.linkAccount!({
      userId: users[0]!,
      provider: 'google',
      providerAccountId: prefix,
      type: 'oauth',
      access_token: 'unused-test-value',
      refresh_token: 'unused-test-value',
      id_token: 'unused-test-value',
    });
    const account = await prisma.account.findUniqueOrThrow({
      where: { provider_providerAccountId: { provider: 'google', providerAccountId: prefix } },
    });
    expect([account.access_token, account.refresh_token, account.id_token]).toEqual([
      null,
      null,
      null,
    ]);
  });
});
