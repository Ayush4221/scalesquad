import { Role } from '@scalesquad/shared';
export function assignRoles(seed: string): Role[] {
  const offset = [...seed].reduce((n, c) => n + c.charCodeAt(0), 0) % Role.options.length;
  return [...Role.options.slice(offset), ...Role.options.slice(0, offset)];
}
