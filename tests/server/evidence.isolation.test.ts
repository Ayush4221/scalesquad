import { describe, it, expect, vi } from 'vitest';
import { fixture } from './fakes';
import { silentEvents } from '../../src/server/lib/ports';
import { ensureEvidence } from '../../src/server/services/evidenceService';
describe('mandatory private evidence isolation', () => {
  it('each caller gets only own evidence; cards never enter public views, audit, chat or notifications', async () => {
    const privatePing = vi.fn();
    const f = fixture({ ...silentEvents, evidenceAvailable: privatePing }),
      id = await f.briefing();
    const cards = await Promise.all(['a', 'b', 'c'].map((u) => f.evidence.get(u, id)));
    expect(new Set(cards.flat().map((c) => c.role)).size).toBe(3);
    const ids = cards.flat().flatMap((c) => c.facts.map((f) => f.id));
    expect(new Set(ids).size).toBe(ids.length);
    const publicData = JSON.stringify({
      view: await f.match.getPublicView('a', id),
      audit: (await f.repo.find(id))?.audit,
      notices: f.chat.notices,
      pings: privatePing.mock.calls,
    });
    for (const fact of cards.flat().flatMap((c) => c.facts))
      expect(publicData).not.toContain(fact.text);
    expect(privatePing.mock.calls.every((c) => c.length === 3 && c[2] === 'BRIEFING')).toBe(true);
    await f.repo.mutate(id, (m) => {
      ensureEvidence(m, 'BRIEFING');
      ensureEvidence(m, 'INCIDENT_EVIDENCE');
    });
    expect((await f.repo.find(id))?.evidence).toHaveLength(6);
    expect(await f.evidence.get('a', id)).toHaveLength(1);
    await expect(f.evidence.get('d', id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(f.evidence.get(null, id)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
