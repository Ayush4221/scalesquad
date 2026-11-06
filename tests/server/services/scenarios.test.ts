import { describe, expect, it } from 'vitest';
import { fixture } from '../fakes';
import { gameControllers } from '../../../src/server/controllers/gameController';
import { buildEvidenceCard, loadScenario } from '../../../src/scenario';
import { scenarioCatalog } from '../../../src/constants/scenarios';

describe('selected mission lifecycle', () => {
  for (const mission of scenarioCatalog)
    it(`plays ${mission.id} with its own evidence and fair replay`, async () => {
      const f = fixture(),
        s = loadScenario(mission.id);
      const view = await f.match.createMatch('a', mission.id);
      expect((await f.repo.find(view.id))?.scenarioId).toBe(mission.id);
      expect(view.scenario.scenarioId).toBe(mission.id);
      await f.match.joinMatch('b', view.joinCode!);
      await f.match.joinMatch('c', view.joinCode!);
      for (const id of ['a', 'b', 'c']) await f.match.setReady(id, view.id, true);
      await f.match.startMatch('a', view.id);
      const m = (await f.repo.find(view.id))!;
      for (const entry of m.evidence)
        expect(entry.card).toEqual(buildEvidenceCard(entry.card.role, 'BRIEFING', s));
      await expect(f.evidence.get('outsider', view.id)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      for (const id of ['a', 'b', 'c']) await f.match.acknowledge(id, view.id);
      await f.run.start('a', view.id, 1);
      expect((await f.repo.find(view.id))?.runs.map((r) => r.result.status)).toEqual([
        'PASSED',
        'FAILED',
      ]);
      await f.match.advance('a', view.id);
      for (const id of ['a', 'b', 'c']) await f.match.acknowledge(id, view.id);
      await f.config.update('a', view.id, s.referenceRepair, 0);
      await f.run.start('a', view.id, 3);
      const finished = await f.match.getPublicView('a', view.id);
      expect(finished.comparison?.status).toBe('PASSED');
      const runs = (await f.repo.find(view.id))!.runs;
      expect(runs[1]!.result.sharedInputHash).toBe(runs[2]!.result.sharedInputHash);
    });
  it('rejects unauthenticated, unknown and extra create fields without creating a match', async () => {
    const f = fixture(),
      c = gameControllers(f.services);
    await expect(f.match.createMatch(null, 'retry-storm')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    await expect(f.match.createMatch('a', 'unknown')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    for (const body of [{ scenarioId: 'unknown' }, { scenarioId: 'retry-storm', budgetLimit: 999 }])
      await expect(c.create({ userId: 'a', name: 'A', matchId: '', body })).rejects.toThrow();
    expect(await f.repo.countMemberships('a')).toBe(0);
  });
});
