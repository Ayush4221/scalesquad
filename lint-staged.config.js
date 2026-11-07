import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';

const MAX_FILES = 30;
const MAX_PATH_LENGTH = 6000;
const tools = {
  prettier: fileURLToPath(new URL('./node_modules/prettier/bin/prettier.cjs', import.meta.url)),
  eslint: fileURLToPath(new URL('./node_modules/eslint/bin/eslint.js', import.meta.url)),
  mobile: fileURLToPath(new URL('./scripts/mobile-tool.mjs', import.meta.url)),
};

function batches(files) {
  const result = [];
  let batch = [];
  let length = 0;
  for (const file of files) {
    if (
      batch.length &&
      (batch.length === MAX_FILES || length + file.length + 3 > MAX_PATH_LENGTH)
    ) {
      result.push(batch);
      batch = [];
      length = 0;
    }
    batch.push(file);
    length += file.length + 3;
  }
  if (batch.length) result.push(batch);
  return result;
}

function run(tool, args) {
  return new Promise((resolve, reject) => {
    // Invoke Node directly: paths with spaces stay individual arguments and
    // Windows does not wrap the entire file list in a limited cmd.exe command.
    const child = spawn(process.execPath, [tools[tool], ...args], {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (data) => {
      output += data;
    });
    child.stderr.on('data', (data) => {
      output += data;
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${tool} failed (${code})\n${output}`));
    });
  });
}

async function check(tool, args, files, log) {
  const chunks = batches(files);
  for (const [index, chunk] of chunks.entries()) {
    log('%s batch %d/%d: %d files', tool, index + 1, chunks.length, chunk.length);
    await run(tool, [...args, ...chunk]);
  }
}

export default {
  '*.{ts,tsx,js,jsx,mjs,cjs,mts,cts,json,css,md,yml,yaml}': {
    title: 'Format and lint staged files (at most 30 per batch)',
    task: async (files, { log }) => {
      const web = files.filter((file) => !resolve(file).startsWith(resolve('mobile') + sep));
      await check('prettier', ['--write'], web, log);
      const code = web.filter((file) => /\.(?:[cm]?[jt]s|[jt]sx)$/i.test(file));
      await check('eslint', ['--no-warn-ignored'], code, log);
    },
  },
  'mobile/**/*.dart': {
    title: 'Format Dart in batches, then analyze the Flutter package',
    task: async (files, { log }) => {
      await check('mobile', ['format'], files, log);
      await run('mobile', ['analyze']);
    },
  },
};
