import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

describe('mobile asset CI checks', () => {
  const root = resolve('.');
  const textOutputs = [
    'mobile/lib/core/theme/app_colors.g.dart',
    'mobile/android/app/src/main/res/values/colors.xml',
    'mobile/assets/licenses/lucide-ISC.txt',
    'mobile/assets/licenses/chivo-OFL.txt',
    'mobile/assets/licenses/bungee-OFL.txt',
  ];
  let fixture = '';

  function check() {
    const result = spawnSync(
      process.execPath,
      [join(root, 'scripts/mobile-assets.mjs'), '--check'],
      {
        cwd: fixture,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 15000,
      },
    );
    if (result.error) throw result.error;
    return result;
  }

  beforeAll(async () => {
    await mkdir(join(root, '.cache'), { recursive: true });
    fixture = await mkdtemp(join(root, '.cache/mobile-assets-test-'));
    for (const path of [
      'mobile/assets',
      'mobile/android/app/src/main/res',
      'mobile/lib/core/theme/app_colors.g.dart',
      'public/icons',
      'public/fonts/landing',
      'node_modules/lucide-react/LICENSE',
    ]) {
      await mkdir(dirname(join(fixture, path)), { recursive: true });
      await cp(join(root, path), join(fixture, path), { recursive: true });
    }
  }, 15000);

  afterAll(async () => {
    if (fixture && fixture.startsWith(join(root, '.cache') + sep))
      await rm(fixture, { recursive: true, force: true });
  });

  it('accepts LF and Windows CRLF text, including copied package licences', async () => {
    const sources = [
      'public/fonts/landing/chivo-OFL.txt',
      'public/fonts/landing/bungee-OFL.txt',
      'node_modules/lucide-react/LICENSE',
    ];
    for (const path of [...textOutputs, ...sources]) {
      const file = join(fixture, path);
      await writeFile(file, (await readFile(file, 'utf8')).replace(/\r\n/g, '\n'));
    }
    expect(check().status).toBe(0);
    for (const path of textOutputs) {
      const file = join(fixture, path);
      await writeFile(file, (await readFile(file, 'utf8')).replace(/\r?\n/g, '\r\n'));
    }
    // npm's package licence stays LF while Git's tracked copies become CRLF.
    expect(check().status).toBe(0);
    for (const path of sources) {
      const file = join(fixture, path);
      await writeFile(file, (await readFile(file, 'utf8')).replace(/\r?\n/g, '\r\n'));
    }
    expect(check().status).toBe(0);
    // This case runs three exporter processes, each bounded to 15 seconds.
  }, 45000);

  it.each([
    ...textOutputs,
    'mobile/assets/fonts/chivo.ttf',
    'mobile/assets/icons/3.0x/traffic.png',
  ])('still rejects real content drift: %s', async (path) => {
    const file = join(fixture, path);
    const original = await readFile(file);
    try {
      await writeFile(file, 'deliberately changed test fixture');
      const result = check();
      expect(result.status).toBe(1);
      expect(result.stderr.replaceAll('\\', '/')).toContain(`Stale mobile asset: ${path}`);
      expect(await readFile(file, 'utf8')).toBe('deliberately changed test fixture');
    } finally {
      await writeFile(file, original);
    }
  });

  it('reports missing licence files without recreating them', async () => {
    const path = 'mobile/assets/licenses/lucide-ISC.txt';
    const file = join(fixture, path);
    const original = await readFile(file);
    try {
      await rm(file);
      const result = check();
      expect(result.status).toBe(1);
      expect(result.stderr.replaceAll('\\', '/')).toContain(`Missing mobile asset: ${path}`);
      await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await writeFile(file, original);
    }
  });
});
