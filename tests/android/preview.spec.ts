import { _android, expect, test, type AndroidDevice } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const applicationId = 'com.example.scalesquad.dev';
const activity = `${applicationId}/com.example.scalesquad_mobile.MainActivity`;
let device: AndroidDevice;
const savedSettings = new Map<string, string>();

type Selector = { desc?: string | RegExp; clazz?: string };
type NativeNode = {
  desc: string;
  clazz: string;
  bounds: { x: number; y: number; width: number; height: number };
  enabled: boolean;
  clickable: boolean;
  selected: boolean;
};

function decodeAttribute(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => {
      const point = Number(code);
      return point <= 0x10ffff ? String.fromCodePoint(point) : '';
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

async function nodes(): Promise<NativeNode[]> {
  // Playwright's legacy Android UI driver can retain stale virtual Flutter nodes
  // on Android 35. Query a fresh SDK accessibility dump through its ADB transport.
  const dumped = (await device.shell('uiautomator dump /sdcard/scalesquad-review.xml')).toString();
  if (!dumped.includes('dumped to:')) return [];
  const xml = (await device.shell('cat /sdcard/scalesquad-review.xml')).toString();
  return [...xml.matchAll(/<node\b[^>]*>/g)].flatMap(([tag]) => {
    const attributes = Object.fromEntries(
      [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [
        key,
        decodeAttribute(value ?? ''),
      ]),
    );
    if (attributes.package !== applicationId) return [];
    const box = attributes.bounds?.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
    if (!box) return [];
    const [x, y, right, bottom] = box.slice(1).map(Number) as [number, number, number, number];
    return [
      {
        desc: attributes['content-desc'] ?? '',
        clazz: attributes.class ?? '',
        bounds: { x, y, width: right - x, height: bottom - y },
        enabled: attributes.enabled === 'true',
        clickable: attributes.clickable === 'true',
        selected: attributes.selected === 'true',
      },
    ];
  });
}

function matching(list: NativeNode[], selector: Selector) {
  return list.find(
    (node) =>
      node.bounds.width > 0 &&
      node.bounds.height > 0 &&
      (!selector.clazz || selector.clazz === node.clazz) &&
      (!selector.desc ||
        (typeof selector.desc === 'string'
          ? node.desc === selector.desc
          : selector.desc.test(node.desc))),
  );
}

async function waitFor(selector: Selector) {
  let found: NativeNode | undefined;
  await expect
    .poll(
      async () => {
        found = matching(await nodes(), selector);
        return Boolean(found);
      },
      { timeout: 45000, intervals: [500, 1000] },
    )
    .toBe(true);
  if (!found) throw new Error('Expected native screen control');
  return found;
}

async function scrollTo(selector: Selector) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const list = await nodes();
    const target = matching(list, selector);
    if (target) return target;
    const scroller = matching(list, { clazz: 'android.widget.ScrollView' });
    if (!scroller) throw new Error('Expected a native scrollable screen');
    const { bounds } = scroller;
    const x = Math.round(bounds.x + bounds.width / 2);
    const from = Math.round(bounds.y + bounds.height * 0.8);
    const to = Math.round(bounds.y + bounds.height * 0.2);
    await device.shell(`input touchscreen swipe ${x} ${from} ${x} ${to} 400`);
  }
  throw new Error(`Native control was not reachable: ${String(selector.desc)}`);
}

async function tap(selector: Selector) {
  const { bounds } = await scrollTo(selector);
  const x = Math.round(bounds.x + bounds.width / 2);
  const y = Math.round(bounds.y + bounds.height / 2);
  await device.shell(`input touchscreen swipe ${x} ${y} ${x} ${y} 100`);
}

async function startApp() {
  await device.shell(`am force-stop ${applicationId}`);
  await device.shell(`am start -n ${activity}`);
  await waitFor({ clazz: 'android.widget.ScrollView' });
}

async function enterMission() {
  await tap({ desc: 'Explore the mission' });
  await waitFor({ desc: 'Meet your squad' });
}

test.beforeAll(async () => {
  const serial = process.env.ANDROID_SERIAL;
  if (!serial || !/^emulator-\d+$/.test(serial))
    throw new Error('Set ANDROID_SERIAL to a dedicated Android emulator, e.g. emulator-5554.');
  const devices = await _android.devices({ omitDriverInstall: true });
  const selected = devices.find((entry) => entry.serial() === serial);
  await Promise.all(devices.filter((entry) => entry !== selected).map((entry) => entry.close()));
  if (!selected) throw new Error('The selected Android emulator is unavailable.');
  device = selected;
  for (const setting of [
    'system font_scale',
    'system accelerometer_rotation',
    'system user_rotation',
    'global animator_duration_scale',
  ])
    savedSettings.set(setting, (await device.shell(`settings get ${setting}`)).toString().trim());
  await device.installApk(await readFile('mobile/build/app/outputs/flutter-apk/app-dev-debug.apk'));
});

test.beforeEach(async () => {
  await device.shell('settings put system font_scale 1');
  await device.shell('settings put system accelerometer_rotation 0');
  await device.shell('settings put system user_rotation 0');
  await device.shell('settings put global animator_duration_scale 1');
  await startApp();
});

test.afterAll(async () => {
  if (!device) return;
  try {
    for (const [setting, value] of savedSettings) {
      const command = /^\d+(\.\d+)?$/.test(value)
        ? `settings put ${setting} ${value}`
        : `settings delete ${setting}`;
      await device.shell(command);
    }
  } finally {
    await device.close();
  }
});

test.afterEach(async ({}, info) => {
  if (info.status !== info.expectedStatus)
    await device.screenshot({ path: info.outputPath('failure.png') });
});

test('cold startup reaches the branded home with a working mission action', async ({}, info) => {
  expect((await waitFor({ desc: 'ScaleSquad' })).enabled).toBe(true);
  expect((await waitFor({ desc: 'Explore the mission' })).clickable).toBe(true);
  await device.screenshot({ path: info.outputPath('home.png') });
  await enterMission();
  await waitFor({ desc: /^Read the surge\./ });
});

test('all roles, disabled voice, hardware back and a fresh visit work', async ({}, info) => {
  await enterMission();
  for (const [role, heading] of [
    ['Data role', /^Protect every pass\./],
    ['Operations role', /^Keep the system moving\./],
    ['Traffic role', /^Read the surge\./],
  ] as const) {
    await tap({ desc: role });
    await waitFor({ desc: heading });
    expect((await waitFor({ desc: role })).selected).toBe(true);
  }
  await device.screenshot({ path: info.outputPath('mission.png') });
  expect((await scrollTo({ desc: 'Join voice' })).enabled).toBe(false);
  await waitFor({ desc: 'Beta' });
  const manifest = (await device.shell(`dumpsys package ${applicationId}`)).toString();
  expect(manifest).not.toContain('android.permission.RECORD_AUDIO');
  await device.screenshot({ path: info.outputPath('voice-disabled.png') });
  await device.shell('input keyevent 4');
  await waitFor({ desc: 'Explore the mission' });
  await enterMission();
  expect((await waitFor({ desc: 'Traffic role' })).selected).toBe(true);
});

test('200 percent Android text keeps the mission and voice reachable', async ({}, info) => {
  await device.shell('settings put system font_scale 2');
  await startApp();
  await enterMission();
  await tap({ desc: 'Operations role' });
  await scrollTo({ desc: /^Keep the system moving\./ });
  await device.screenshot({ path: info.outputPath('large-text.png') });
  expect((await scrollTo({ desc: 'Join voice' })).enabled).toBe(false);
  await device.shell('input keyevent 4');
  await scrollTo({ desc: 'Explore the mission' });
});

test('landscape and reduced system motion keep navigation usable', async ({}, info) => {
  await device.shell('settings put system user_rotation 1');
  await device.shell('settings put global animator_duration_scale 0');
  await startApp();
  await enterMission();
  await tap({ desc: 'Data role' });
  await scrollTo({ desc: /^Protect every pass\./ });
  await device.screenshot({ path: info.outputPath('landscape.png') });
  await device.shell('input keyevent 4');
  await scrollTo({ desc: 'Explore the mission' });
});
