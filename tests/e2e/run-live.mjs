import { spawn } from 'node:child_process';
import { loadCredentials } from './settings.ts';
const configured = await loadCredentials();
if (
  !configured.baseURL ||
  !Object.values(configured.users).some((user) => user.email && user.password)
)
  throw new Error(
    'Fill credentials.js baseURL and at least one test account before configured-account checks',
  );
const child = spawn(
  process.execPath,
  [
    'node_modules/@playwright/test/cli.js',
    'test',
    '--project=configured-users',
    ...process.argv.slice(2),
  ],
  { env: { ...process.env, E2E_LIVE_ONLY: '1' }, stdio: 'inherit', windowsHide: true },
);
child.once('exit', (code) => {
  process.exitCode = code ?? 1;
});
