import { describe, expect, it } from 'vitest';
import { assertAndroidReleaseContext } from '../../scripts/android-release.ts';

const sha = 'a'.repeat(40);
const master = {
  GITHUB_ACTIONS: 'true',
  GITHUB_REF: 'refs/heads/master',
  GITHUB_EVENT_NAME: 'push',
  GITHUB_SHA: sha,
};

describe('Android production release boundary', () => {
  it('allows a local master checkout', () => {
    expect(() => assertAndroidReleaseContext({ branch: 'master', sha, env: {} })).not.toThrow();
  });
  it('allows the exact master commit checked out by GitHub Actions', () => {
    expect(() => assertAndroidReleaseContext({ branch: '', sha, env: master })).not.toThrow();
  });
  it('allows manual master builds', () => {
    expect(() =>
      assertAndroidReleaseContext({
        branch: '',
        sha,
        env: { ...master, GITHUB_EVENT_NAME: 'workflow_dispatch' },
      }),
    ).not.toThrow();
  });
  it.each(['development', 'feature/release', 'main'])(
    'rejects %s even with master CI variables',
    (branch) => {
      expect(() => assertAndroidReleaseContext({ branch, sha, env: master })).toThrow(
        'only on master',
      );
    },
  );
  it.each([
    { GITHUB_REF: 'refs/heads/development' },
    { GITHUB_REF: 'refs/tags/v1.0.0' },
    { GITHUB_REF: 'refs/pull/1/merge', GITHUB_EVENT_NAME: 'pull_request' },
    { GITHUB_EVENT_NAME: 'pull_request_target' },
    { GITHUB_SHA: 'b'.repeat(40) },
    { GITHUB_ACTIONS: 'false' },
    { GITHUB_SHA: '' },
  ])('rejects an untrusted detached context: %j', (override) => {
    expect(() =>
      assertAndroidReleaseContext({ branch: '', sha, env: { ...master, ...override } }),
    ).toThrow('only on master');
  });
});
