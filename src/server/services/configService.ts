import { ConfigurationChange, ConfigurationValues, AppError, parse } from '@scalesquad/shared';
import { loadScenario } from '@scalesquad/scenario';
import type { GameRepository } from '../domain/models';
import type { Clock, DomainEvents } from '../domain/ports';
import { audit, currentConfig, editable, member } from './guards';
export class ConfigService {
  constructor(
    private readonly repo: GameRepository,
    private readonly clock: Clock,
    private readonly events: DomainEvents,
  ) {}
  async get(userId: string | null, id: string) {
    const m = await this.repo.find(id);
    if (!m) throw new AppError('NOT_FOUND', 404);
    member(m, userId);
    const c = currentConfig(m);
    return { version: c.version, values: c.values };
  }
  async update(userId: string | null, id: string, change: unknown, expectedVersion: number) {
    const valid = parse(ConfigurationChange, change);
    const result = await this.repo.mutate(id, (m) => {
      const lock = editable(m, userId, this.clock.now());
      const c = currentConfig(m);
      if (c.version !== expectedVersion)
        throw new AppError('VERSION_CONFLICT', 409, 'Configuration changed; refresh and try again');
      const next = {
        version: c.version + 1,
        values: ConfigurationValues.parse({ ...c.values, ...valid }),
        createdByUserId: userId!,
      };
      m.configurations.push(next);
      lock.configurationVersion = next.version;
      lock.expiresAt =
        this.clock.now() + loadScenario(m.scenarioId, m.scenarioVersion).match.lockLeaseMs;
      audit(m, userId!, 'config.update', { version: next.version });
      return { version: next.version, values: next.values };
    });
    this.events.changed(id);
    return result;
  }
}
