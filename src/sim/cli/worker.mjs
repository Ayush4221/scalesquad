import { parentPort, workerData } from 'node:worker_threads';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = pathToFileURL(resolve('dist/src') + '/').href;
// Resolve TypeScript aliases within our compiled code only.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const alias = /^@scalesquad\/(sim|scenario|shared)$/.exec(specifier);
    if (alias) return nextResolve(`${root}${alias[1]}/index.js`, context);
    if (
      context.parentURL?.startsWith(root) &&
      specifier.startsWith('.') &&
      !['.js', '.mjs', '.json'].includes(extname(specifier))
    ) {
      const file = new URL(specifier + '.js', context.parentURL);
      return nextResolve(
        existsSync(file) ? file.href : new URL(specifier + '/index.js', context.parentURL).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(root) && url.endsWith('.json'))
      return {
        format: 'module',
        shortCircuit: true,
        source: `export default ${JSON.stringify(JSON.parse(readFileSync(new URL(url), 'utf8')))};`,
      };
    return nextLoad(url, context);
  },
});
const { runSimulation } = await import(`${root}sim/index.js`);
parentPort.postMessage(runSimulation(workerData));
