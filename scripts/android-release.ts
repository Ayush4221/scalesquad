// Accept local master or the exact detached commit of a master GitHub build.
export function assertAndroidReleaseContext({
  branch,
  sha,
  env,
}: {
  branch: string;
  sha: string;
  env: Record<string, string | undefined>;
}): void {
  const detachedMaster =
    branch === '' &&
    env.GITHUB_ACTIONS === 'true' &&
    env.GITHUB_REF === 'refs/heads/master' &&
    ['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME ?? '') &&
    Boolean(env.GITHUB_SHA) &&
    sha === env.GITHUB_SHA;
  if (branch !== 'master' && !detachedMaster)
    throw new Error('Android release builds are allowed only on master.');
}
