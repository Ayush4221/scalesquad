import campuspass from './data/campuspass.v1.json';
import { AppError, contentHash, deepFreeze } from '@scalesquad/shared';
import { ScenarioConfigSchema } from './schema';
export * from './schema';
export * from './evidence';
export { toPublicScenario } from './public';

export function loadScenario(id = 'campuspass', version = '1') {
  if (id !== 'campuspass' || version !== '1')
    throw new AppError('NOT_FOUND', 404, 'Scenario not found');
  const scenario = ScenarioConfigSchema.parse(campuspass);
  return deepFreeze({ ...scenario, scenarioHash: contentHash(scenario) });
}
