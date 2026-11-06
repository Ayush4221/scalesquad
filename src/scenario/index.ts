import campuspass from './data/campuspass.v1.json';
import retryStorm from './data/retry-storm.v1.json';
import splitGates from './data/split-gates.v1.json';
import flashCrowd from './data/flash-crowd.v1.json';
import { AppError, contentHash, deepFreeze } from '@scalesquad/shared';
import { ScenarioConfigSchema } from './schema';
export * from './schema';
export * from './evidence';
export { toPublicScenario } from './public';
const scenarios = [campuspass, retryStorm, splitGates, flashCrowd];

export function loadScenario(id = 'campuspass', version = '1') {
  const data = scenarios.find((s) => s.scenarioId === id && s.scenarioVersion === version);
  if (!data) throw new AppError('NOT_FOUND', 404, 'Scenario not found');
  const scenario = ScenarioConfigSchema.parse(data);
  return deepFreeze({ ...scenario, scenarioHash: contentHash(scenario) });
}
