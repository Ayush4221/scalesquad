import { spawn, spawnSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { databaseURL, localBaseURL, assertTestDatabase } from './settings';
if (process.env.NODE_ENV !== 'test') throw new Error('E2E server requires NODE_ENV=test');
assertTestDatabase();
const origin = new URL(localBaseURL);
if (origin.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(origin.hostname))
  throw new Error('Disposable E2E server must use local HTTP');
const run = promisify(execFile),
  cluster = resolve('.cache/playwright-postgres');
const pg =
  process.env.PG_BIN ?? (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/17/bin' : '');
const binary = (name: string) =>
  pg ? resolve(pg, `${name}${process.platform === 'win32' ? '.exe' : ''}`) : name;
let owned: 'native' | 'docker' | null = null;
function pgctl(args: string[]) {
  const result = spawnSync(binary('pg_ctl'), args, {
    stdio: 'ignore',
    windowsHide: true,
    timeout: 30000,
  });
  if (result.status !== 0) throw new Error('Local test Postgres control failed');
}
async function prepareDatabase() {
  if (process.env.E2E_DATABASE_URL) return;
  await mkdir(resolve('.cache'), { recursive: true });
  if (pg && existsSync(binary('initdb'))) {
    if (!existsSync(resolve(cluster, 'PG_VERSION')))
      await run(
        binary('initdb'),
        ['-D', cluster, '-U', 'scalesquad_test', '-A', 'trust', '--encoding=UTF8', '--no-locale'],
        { windowsHide: true },
      );
    let running = false;
    try {
      await run(binary('pg_ctl'), ['-D', cluster, 'status'], { windowsHide: true });
      running = true;
    } catch {
      /* Start only the task-owned cluster. */
    }
    if (!running) {
      pgctl([
        '-D',
        cluster,
        '-l',
        resolve('.cache/playwright-postgres.log'),
        '-o',
        '-h 127.0.0.1 -p 55433',
        'start',
        '-w',
      ]);
      owned = 'native';
    }
    try {
      await run(
        binary('createdb'),
        ['-h', '127.0.0.1', '-p', '55433', '-U', 'scalesquad_test', 'scalesquad_e2e_test'],
        { windowsHide: true },
      );
    } catch (error) {
      if (!String((error as { stderr?: string }).stderr).includes('already exists'))
        throw new Error('Could not prepare isolated E2E database');
    }
  } else {
    await run(
      'docker',
      ['compose', '-f', 'tests/e2e/compose.yml', '-p', 'scalesquad-e2e', 'up', '-d', '--wait'],
      { windowsHide: true },
    );
    owned = 'docker';
  }
}
async function stopDatabase() {
  if (owned === 'native') pgctl(['-D', cluster, 'stop', '-m', 'fast', '-w']);
  if (owned === 'docker')
    await run(
      'docker',
      ['compose', '-f', 'tests/e2e/compose.yml', '-p', 'scalesquad-e2e', 'down'],
      { windowsHide: true },
    );
}
try {
  await prepareDatabase();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: databaseURL,
    DIRECT_URL: databaseURL,
    APP_ORIGIN: localBaseURL,
    AUTH_SECRET: randomBytes(32).toString('hex'),
    AUTH_GOOGLE_ID: '',
    AUTH_GOOGLE_SECRET: '',
    AUTH_GITHUB_ID: '',
    AUTH_GITHUB_SECRET: '',
    NEXCONN_APP_KEY: '',
    NEXCONN_APP_SECRET: '',
    NEXCONN_PROVIDER: 'fake',
    TEST_BUILT_APP: '1',
    VAPID_PUBLIC_KEY: '',
    VAPID_PRIVATE_KEY: '',
    VAPID_SUBJECT: '',
    LOG_LEVEL: 'warn',
    TRUSTED_PROXY_IPS: '127.0.0.1',
  };
  await run(
    process.execPath,
    [
      'node_modules/prisma/build/index.js',
      'migrate',
      'deploy',
      '--schema',
      'src/db/prisma/schema.prisma',
    ],
    { env, windowsHide: true },
  );
  const server = spawn(process.execPath, ['--import', 'tsx', 'src/server/main.ts'], {
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  });
  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    server.kill('SIGTERM');
    await stopDatabase().catch(() => {});
  }
  process.once('SIGTERM', () => {
    void stop().then(() => process.exit(0));
  });
  process.once('SIGINT', () => {
    void stop().then(() => process.exit(0));
  });
  server.once('exit', (code) => {
    void stop().then(() => {
      process.exitCode = code ?? 1;
    });
  });
} catch {
  await stopDatabase().catch(() => {});
  process.stderr.write(
    'E2E server setup failed. Check the isolated database and production build. No credentials were printed.\n',
  );
  process.exitCode = 1;
}
