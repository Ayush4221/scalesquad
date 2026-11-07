import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const mobile = resolve(root, 'mobile');
const expected = { flutter: '3.47.1', dart: '3.13.1' };
const lookup = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['flutter'], {
  encoding: 'utf8',
  windowsHide: true,
});
const flutterPath = lookup.stdout?.trim().split(/\r?\n/)[0];
if (lookup.status !== 0 || !flutterPath)
  throw new Error('Flutter is missing from PATH. See mobile/README.md.');
const sdk = dirname(dirname(flutterPath));
const dart = join(
  sdk,
  'bin/cache/dart-sdk/bin',
  process.platform === 'win32' ? 'dart.exe' : 'dart',
);
const snapshot = join(sdk, 'bin/cache/flutter_tools.snapshot');
if (!existsSync(dart) || !existsSync(snapshot))
  throw new Error('Initialize the Flutter SDK with flutter --version first.');
const env = { ...process.env, FLUTTER_ROOT: sdk };
function run(file, args, capture = false) {
  const result = spawnSync(file, args, {
    cwd: mobile,
    env,
    shell: false,
    windowsHide: true,
    ...(capture ? { encoding: 'utf8' } : { stdio: 'inherit' }),
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture) process.stderr.write(result.stderr ?? '');
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}
const version = JSON.parse(run(dart, [snapshot, '--version', '--machine'], true));
if (
  version.frameworkVersion !== expected.flutter ||
  version.dartSdkVersion.split(' ')[0] !== expected.dart
)
  throw new Error(`Use Flutter ${expected.flutter} / Dart ${expected.dart}; see mobile/README.md.`);
const [mode = 'check', ...files] = process.argv.slice(2);
if (mode === 'format') {
  const paths = files.map((file) => resolve(file));
  if (paths.some((path) => !path.startsWith(mobile + sep) || !path.endsWith('.dart')))
    throw new Error('Only mobile Dart files may be formatted by this command.');
  if (paths.length) run(dart, ['format', ...paths]);
} else if (mode === 'analyze') run(dart, [snapshot, 'analyze', '--no-pub']);
else if (mode === 'test') run(dart, [snapshot, 'test', '--no-pub']);
else if (mode === 'build')
  run(dart, [snapshot, 'build', 'apk', '--debug', '--flavor', 'dev', '--no-pub']);
else if (mode === 'check') {
  run(dart, [
    'format',
    '--output=none',
    '--set-exit-if-changed',
    'lib',
    'test',
    'integration_test',
  ]);
  run(dart, [snapshot, 'analyze', '--no-pub']);
  run(dart, [snapshot, 'test', '--no-pub']);
} else throw new Error(`Unknown mobile command: ${mode}`);
