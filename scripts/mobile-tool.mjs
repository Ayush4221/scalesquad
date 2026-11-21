import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertAndroidReleaseContext } from './android-release.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const mobile = resolve(root, 'mobile');
const [mode = 'check', ...files] = process.argv.slice(2);
if (mode === 'release') {
  const gitValue = (args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) throw new Error('Cannot verify the release Git context.');
    return result.stdout.trim();
  };
  assertAndroidReleaseContext({
    branch: gitValue(['branch', '--show-current']),
    sha: gitValue(['rev-parse', 'HEAD']),
    env: process.env,
  });
  for (const name of [
    'ANDROID_KEYSTORE_PATH',
    'ANDROID_KEYSTORE_PASSWORD',
    'ANDROID_KEY_ALIAS',
    'ANDROID_KEY_PASSWORD',
  ]) {
    if (!process.env[name]) throw new Error(`Missing ${name}; see docs/ANDROID_RELEASE.md.`);
  }
  if (!existsSync(process.env.ANDROID_KEYSTORE_PATH))
    throw new Error('The release keystore file is missing.');
  if (process.env.ANDROID_BUILD_NUMBER && !/^[1-9]\d*$/.test(process.env.ANDROID_BUILD_NUMBER))
    throw new Error('ANDROID_BUILD_NUMBER must be a positive integer.');
}
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
if (mode === 'format') {
  const paths = files.map((file) => resolve(file));
  if (paths.some((path) => !path.startsWith(mobile + sep) || !path.endsWith('.dart')))
    throw new Error('Only mobile Dart files may be formatted by this command.');
  if (paths.length) run(dart, ['format', ...paths]);
} else if (mode === 'analyze') run(dart, [snapshot, 'analyze', '--no-pub']);
else if (mode === 'test') run(dart, [snapshot, 'test', '--no-pub']);
else if (mode === 'build')
  run(dart, [snapshot, 'build', 'apk', '--debug', '--flavor', 'dev', '--no-pub']);
else if (mode === 'release') {
  const number = process.env.ANDROID_BUILD_NUMBER;
  for (const format of ['apk', 'appbundle'])
    run(dart, [
      snapshot,
      'build',
      format,
      '--release',
      '--flavor',
      'prod',
      // Flutter must regenerate native registrants without dev-only plugins.
      // --no-pub skips that step and leaves integration_test in release Java.
      '--pub',
      ...(number ? [`--build-number=${number}`] : []),
    ]);
} else if (mode === 'check') {
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
