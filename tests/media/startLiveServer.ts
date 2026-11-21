import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Only this explicit media entry point uses the real provider. The database,
// users, sessions and game server remain isolated by the E2E server guards.
const configured = parseEnv(readFileSync('.env', 'utf8'));
for (const key of ['NEXCONN_APP_KEY', 'NEXCONN_APP_SECRET', 'NEXCONN_REGION']) {
  if (configured[key]) process.env[key] = configured[key];
}
if (!process.env.NEXCONN_APP_KEY || !process.env.NEXCONN_APP_SECRET)
  throw new Error('Live media capture requires configured Nexconn credentials');
process.env.E2E_LIVE_NEXCONN = '1';
await import('../e2e/startServer');
