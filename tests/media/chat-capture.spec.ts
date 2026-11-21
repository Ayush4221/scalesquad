import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { BrowserContext, Locator, Page, Video } from '@playwright/test';
import type { ConfigurationValues } from '../../src/shared/domain';
import { test, expect, selectTab } from '../e2e/fixtures';
import { NexconnChatProvider } from '../../src/nexconn/provider';
import { parseEnv } from 'node:util';
import { localBaseURL } from '../e2e/settings';

const output = resolve('../ScaleSquad-Chat-Demo-2026-11-14');
interface Actor {
  name: string;
  page: Page;
  context: BrowserContext;
  video: Video;
  began: number;
  clicks: number[];
}
test('record live Nexconn discussion across three device sizes', async ({ squad: s, browser }) => {
  for (const folder of ['screenshots', 'source', 'video', 'source/audio'])
    await mkdir(resolve(output, folder), { recursive: true });
  const actors: Actor[] = [];
  const clips: { id: string; actor: string; start: number; end: number; clicks: number[] }[] = [];
  const pointerScript = () => {
    document.addEventListener('DOMContentLoaded', () => {
      const cursor = document.createElement('div');
      cursor.dataset.demoCursor = 'true';
      cursor.style.cssText =
        'position:fixed;left:0;top:0;width:26px;height:34px;z-index:2147483647;pointer-events:none;transform:translate(-80px,-80px);filter:drop-shadow(0 2px 3px #090c10);';
      cursor.innerHTML =
        '<svg width="26" height="34" viewBox="0 0 26 34"><path d="M3 2 L3 26 L9 20 L14 31 L19 28 L14 18 L23 18 Z" fill="#edf2f7" stroke="#090c10" stroke-width="2"/></svg>';
      document.body.append(cursor);
      document.addEventListener('pointermove', (event) => {
        cursor.style.transform = `translate(${event.clientX}px,${event.clientY}px)`;
      });
      document.addEventListener('pointerdown', (event) => {
        const ring = document.createElement('div');
        ring.dataset.demoRipple = 'true';
        ring.style.cssText = `position:fixed;left:${event.clientX - 16}px;top:${event.clientY - 16}px;width:32px;height:32px;border:3px solid #c2ff64;border-radius:50%;z-index:2147483646;pointer-events:none;`;
        document.body.append(ring);
        const animation = ring.animate(
          [
            { transform: 'scale(.5)', opacity: 1 },
            { transform: 'scale(2.5)', opacity: 0 },
          ],
          { duration: 550, easing: 'ease-out' },
        );
        animation.onfinish = () => ring.remove();
      });
    });
  };
  const now = (actor: Actor) => (Date.now() - actor.began) / 1000;
  async function focus(actor: Actor, target: Locator) {
    await target.evaluate((el) => {
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    await actor.page.waitForTimeout(750);
    await actor.page.evaluate(() => window.scrollBy({ top: -58, behavior: 'smooth' }));
    await actor.page.waitForTimeout(450);
  }
  async function click(actor: Actor, target: Locator) {
    await expect(target).toBeEnabled();
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error('Missing demo control');
    await actor.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 24 });
    await actor.page.waitForTimeout(180);
    actor.clicks.push(now(actor));
    await target.click();
    await actor.page.waitForTimeout(450);
  }
  async function shot(name: string, actor: Actor, target?: Locator) {
    const options = {
      path: resolve(output, 'screenshots', `${name}.png`),
      animations: 'disabled' as const,
      style: '.status-bar,[data-demo-cursor],[data-demo-ripple] {visibility:hidden!important;}',
    };
    await actor.page.evaluate(() => document.fonts.ready);
    if (target) await target.screenshot(options);
    else await actor.page.screenshot({ ...options, fullPage: true });
  }
  async function scene(id: string, actor: Actor, action: () => Promise<void>) {
    process.stdout.write(`Recording ${id}\n`);
    const start = now(actor);
    await action();
    const end = now(actor);
    clips.push({
      id,
      actor: actor.name,
      start,
      end,
      clicks: actor.clicks.filter((time) => time >= start && time <= end),
    });
  }
  async function discuss(actor: Actor, text: string) {
    await scene(`chat-${clips.filter((c) => c.id.startsWith('chat-')).length}`, actor, async () => {
      await selectTab(actor.page, 'Chat');
      process.stdout.write(`Chat ${actor.name}: tab selected\n`);
      const composer = actor.page.getByRole('textbox', { name: 'Message your squad' });
      await expect(composer).toBeEnabled({ timeout: 45000 });
      process.stdout.write(`Chat ${actor.name}: connected\n`);
      await composer.scrollIntoViewIfNeeded();
      await composer.pressSequentially(text, { delay: 28 });
      process.stdout.write(`Chat ${actor.name}: typed\n`);
      await click(actor, actor.page.getByRole('button', { name: 'Send', exact: true }));
      await expect(composer).toHaveValue('', { timeout: 15000 });
      process.stdout.write(`Chat ${actor.name}: sent\n`);
      for (const other of actors) {
        process.stdout.write(`Verifying recipient ${other.name}\n`);
        await selectTab(other.page, 'Chat');
        const message = other.page
          .getByRole('log', { name: 'Squad messages' })
          .getByText(text, { exact: true })
          .first();
        try {
          await expect(message).toBeVisible({ timeout: 6000 });
        } catch {
          // Exercise the actual provider's persisted history on reconnection.
          process.stdout.write(`Rechecking persisted delivery for ${other.name}\n`);
          await other.page.reload();
          await selectTab(other.page, 'Chat');
          await expect(message).toBeVisible({ timeout: 30000 });
        }
        await message.scrollIntoViewIfNeeded();
      }
      await actor.page.waitForTimeout(1000);
    });
  }
  async function choose(actor: Actor, label: string, option: string) {
    await click(actor, actor.page.getByLabel(label, { exact: true }));
    const dialog = actor.page.getByRole('dialog');
    await click(
      actor,
      (await dialog.isVisible())
        ? dialog.getByRole('button', { name: option, exact: true })
        : actor.page.getByRole('option', { name: option, exact: true }),
    );
    await expect(actor.page.getByLabel(label, { exact: true })).toBeEnabled();
  }
  try {
    for (const [index, name] of ['Alex', 'Maya', 'Jordan'].entries()) {
      const original = s.players[index]!;
      await s.db.user.update({ where: { id: original.id }, data: { name } });
      const context = await browser.newContext({
        baseURL: localBaseURL,
        viewport:
          index === 0
            ? { width: 1280, height: 800 }
            : index === 1
              ? { width: 430, height: 932 }
              : { width: 1024, height: 768 },
        isMobile: index === 1,
        hasTouch: index !== 0,
        deviceScaleFactor: 2,
        storageState: await original.context.storageState(),
        recordVideo: {
          dir: resolve('.cache/chat-demo/recordings'),
          size:
            index === 0
              ? { width: 1280, height: 800 }
              : index === 1
                ? { width: 430, height: 932 }
                : { width: 1024, height: 768 },
        },
        serviceWorkers: 'block',
      });
      if (index !== 1)
        await context.addCookies([{ name: 'scalesquad-theme', value: 'light', url: localBaseURL }]);
      await context.addInitScript(pointerScript);
      await context.route('**/*', (route) =>
        new URL(route.request().url()).origin === localBaseURL ||
        /(^|[.])(?:sg|us|sau)-light-(?:edge|api)[.]com$/.test(
          new URL(route.request().url()).hostname.replace(/^.*?(?=(?:sg|us|sau)-light)/, ''),
        ) ||
        /(?:sg|us|sau)-light-(?:edge|api)[.]com$/.test(new URL(route.request().url()).hostname)
          ? route.continue()
          : route.abort(),
      );

      const page = await context.newPage();
      const actor = {
        name,
        page,
        context,
        video: page.video()!,
        began: Date.now(),
        clicks: [] as number[],
      };
      actors.push(actor);
      await original.context.close();
      s.players[index] = { ...original, name, context, page };
      await page.goto('/play');
      await page.evaluate(() => document.fonts.ready);
    }
    const [host, maya, jordan] = actors as [Actor, Actor, Actor];
    const roleActors: Record<string, Actor> = {};
    await scene('create', host, async () => {
      await host.page.waitForTimeout(700);
      await click(host, host.page.getByRole('button', { name: 'Create squad' }));
      await expect(host.page).toHaveURL(/\/match\//);
      await host.page.waitForTimeout(1000);
    });
    s.matchId = new URL(host.page.url()).pathname.split('/')[2]!;
    const view = (await (
      await host.context.request.get(`/api/game/matches/${s.matchId}`)
    ).json()) as { joinCode: string };
    for (const actor of [maya, jordan]) {
      await scene(`join-${actor.name}`, actor, async () => {
        await click(actor, actor.page.getByRole('textbox', { name: 'Join code' }));
        await actor.page
          .getByRole('textbox', { name: 'Join code' })
          .pressSequentially(view.joinCode, { delay: 130 });
        await actor.page.waitForTimeout(400);
        await click(actor, actor.page.getByRole('button', { name: 'Join', exact: false }));
        await expect(actor.page).toHaveURL(new RegExp(s.matchId));
        await actor.page.waitForTimeout(800);
      });
    }
    await expect(host.page.locator('.roster li')).toHaveCount(3);
    await shot(
      '02-complete-squad',
      host,
      host.page.locator('section[aria-labelledby="control-room-title"]'),
    );
    await discuss(host, 'We saw the Microsoft apps outage. Let us practise recovery as a team.');
    await discuss(maya, 'I am on my phone. Nexconn messages are coming through.');
    await discuss(jordan, 'Tablet here. Same squad, same discussion.');
    for (const actor of actors)
      await scene(`ready-${actor.name}`, actor, async () => {
        await click(actor, actor.page.getByRole('button', { name: 'Ready up', exact: true }));
        await expect(
          actor.page.getByRole('button', { name: 'Not ready', exact: true }),
        ).toBeEnabled();
      });
    await scene('start', host, async () => {
      await click(host, host.page.getByRole('button', { name: 'Start match', exact: true }));
      await expect(host.page.locator('.status-bar')).toContainText('BRIEFING');
      await host.page.waitForTimeout(700);
    });
    for (const [index, actor] of actors.entries()) {
      await selectTab(actor.page, 'Brief');
      await expect(actor.page.locator('.tab-brief')).toContainText(/opening brief/i);
      const roleView = (await (
        await actor.context.request.get(`/api/game/matches/${s.matchId}`)
      ).json()) as { ownRole: string };
      roleActors[roleView.ownRole] = actor;
      await shot(
        `03-${roleView.ownRole.toLowerCase()}-complete-evidence`,
        actor,
        actor.page.locator('.tab-brief'),
      );
      await scene(`brief-${index}`, actor, async () => {
        await focus(actor, actor.page.locator('.tab-brief'));
        await actor.page.waitForTimeout(2600);
      });
    }
    await discuss(
      roleActors.TRAFFIC!,
      'Traffic clue: a burst is arriving. What do your clues show?',
    );
    await discuss(roleActors.DATA!, 'Data clue: we must admit each pass only once.');
    await discuss(
      roleActors.OPS!,
      'Operations clue: capacity costs credits. Let us measure before spending.',
    );
    for (const actor of actors)
      await scene(`ack-${actor.name}`, actor, async () => {
        await selectTab(actor.page, 'Brief');
        await click(actor, actor.page.getByRole('button', { name: 'I’ve read my evidence' }));
      });
    await expect(host.page.locator('.status-bar')).toContainText(/REPAIR[ _]1/);
    await shot('04-complete-repair-console', host, host.page.locator('.tab-repair'));
    await scene('baseline-run', host, async () => {
      await click(host, host.page.getByRole('button', { name: 'Run baseline + incident' }));
      await expect(host.page.getByRole('button', { name: 'Reveal incident evidence' })).toBeEnabled(
        { timeout: 30000 },
      );
      await host.page.waitForTimeout(800);
    });
    const failed = host.page.locator('.tab-results .run-grid [data-slot="card"]').nth(1);
    await shot('05-complete-incident-failure', host, failed);
    await scene('failure', host, async () => {
      await focus(host, failed);
      await host.page.waitForTimeout(1800);
      const detail = failed.locator('summary').first();
      if (await detail.count()) await click(host, detail);
      await host.page.waitForTimeout(1500);
    });
    await scene('reveal', host, async () => {
      await click(host, host.page.getByRole('button', { name: 'Reveal incident evidence' }));
      await expect(host.page.locator('.status-bar')).toContainText(/INCIDENT[ _]EVIDENCE/);
      await focus(host, host.page.locator('.tab-brief'));
      await host.page.waitForTimeout(2000);
    });
    await shot('06-complete-incident-evidence', host, host.page.locator('.tab-brief'));
    for (const actor of actors)
      await scene(`ack-incident-${actor.name}`, actor, async () => {
        await selectTab(actor.page, 'Brief');
        await click(actor, actor.page.getByRole('button', { name: 'I’ve read my evidence' }));
      });
    await selectTab(host.page, 'Repair');
    await selectTab(maya.page, 'Repair');
    await discuss(
      host,
      'The incident exposed duplicates. Maya, take control and protect the write.',
    );
    await discuss(maya, 'I will keep retries on the same key and make check-in atomic.');
    await selectTab(host.page, 'Repair');
    await selectTab(maya.page, 'Repair');
    await scene('handoff', host, async () => {
      await choose(host, 'Pass control to', 'Maya');
      await click(host, host.page.getByRole('button', { name: 'Pass control', exact: true }));
      await expect(maya.page.getByLabel('App capacity', { exact: true })).toBeEnabled();
      await host.page.waitForTimeout(600);
    });
    await shot('07-complete-shared-editor', maya, maya.page.locator('.tab-repair'));
    const values = (
      JSON.parse(await readFile(resolve('src/scenario/data/campuspass.v1.json'), 'utf8')) as {
        referenceRepair: ConfigurationValues;
      }
    ).referenceRepair;
    await scene('repair', maya, async () => {
      await focus(maya, maya.page.locator('.tab-repair'));
      await choose(
        maya,
        'App capacity',
        values.appCapacity === 'MEDIUM' ? 'Medium' : values.appCapacity === 'HIGH' ? 'High' : 'Low',
      );
      await choose(
        maya,
        'Database capacity',
        values.dbCapacity === 'MEDIUM' ? 'Medium' : values.dbCapacity === 'HIGH' ? 'High' : 'Low',
      );
      await choose(maya, 'Retry policy', 'Retry once, same key');
      const atomic = maya.page.getByRole('switch', { name: 'Atomic check-in' });
      if ((await atomic.getAttribute('aria-checked')) !== String(values.atomicCheckin))
        await click(maya, atomic);
      await expect(maya.page.getByLabel('App capacity', { exact: true })).toBeEnabled();
      await maya.page.waitForTimeout(1100);
    });
    await shot('08-complete-repaired-configuration', maya, maya.page.locator('.tab-repair'));
    await discuss(jordan, 'Run the same incident again so we can compare fairly.');
    await selectTab(maya.page, 'Repair');
    await scene('repair-run', maya, async () => {
      await click(maya, maya.page.getByRole('button', { name: 'Run repair' }));
      await expect(maya.page.locator('.status-bar')).toContainText('COMPARE', { timeout: 30000 });
      await maya.page.waitForTimeout(1200);
    });
    const comparison = maya.page.locator('.tab-results [data-slot="card"]').first();
    await expect(comparison).toContainText('PASSED');
    await shot('09-complete-comparison', maya, comparison);
    await scene('comparison', maya, async () => {
      await focus(maya, comparison);
      await maya.page.waitForTimeout(2500);
      await maya.page.evaluate(() => window.scrollBy({ top: 320, behavior: 'smooth' }));
      await maya.page.waitForTimeout(2200);
      await focus(maya, maya.page.getByRole('region', { name: 'Configuration changes' }));
      await maya.page.waitForTimeout(1800);
    });
    await shot('10-complete-final-results-page', maya);
    await discuss(maya, 'The repair passed. We spent more, but stayed inside our budget.');
    await discuss(host, 'We compared clues, made a change and tested it. That is the lesson.');
    await selectTab(host.page, 'Results');
    await scene('finish', host, async () => {
      await click(host, host.page.getByRole('button', { name: 'Finish match', exact: true }));
      await expect(host.page.locator('.status-bar')).toContainText('FINISHED');
      await host.page.waitForTimeout(1400);
    });
    const result = (await (
      await maya.context.request.get(`/api/game/matches/${s.matchId}`)
    ).json()) as {
      comparison: { status: string };
      runs: { runNumber: number; result: { sharedInputHash: string } }[];
    };
    expect(result.comparison.status).toBe('PASSED');
    expect(result.runs[1]!.result.sharedInputHash).toBe(result.runs[2]!.result.sharedInputHash);
    await writeFile(resolve(output, 'source/result.json'), JSON.stringify(result, null, 2));
    await writeFile(resolve(output, 'source/clips.json'), JSON.stringify(clips, null, 2));
    const anonymous = await browser.newContext({
      baseURL: localBaseURL,
      viewport: { width: 960, height: 650 },
      deviceScaleFactor: 2,
      serviceWorkers: 'block',
    });
    try {
      const home = await anonymous.newPage();
      await home.goto('/');
      await home.evaluate(() => document.fonts.ready);
      await home.locator('section[aria-labelledby="home-title"]').screenshot({
        path: resolve(output, 'screenshots/01-complete-home-hero.png'),
        animations: 'disabled',
      });
      await home.screenshot({
        path: resolve(output, 'screenshots/01b-complete-home-page.png'),
        fullPage: true,
        animations: 'disabled',
      });
    } finally {
      await anonymous.close();
    }
  } finally {
    await writeFile(resolve(output, 'source/clips.json'), JSON.stringify(clips, null, 2));
    await writeFile(
      resolve(output, 'source/device-timeline.json'),
      JSON.stringify(
        actors.map((a) => ({ name: a.name, began: a.began })),
        null,
        2,
      ),
    );
    if (s.matchId) {
      const configured = parseEnv(await readFile('.env', 'utf8'));
      const provider = new NexconnChatProvider(
        configured.NEXCONN_APP_KEY!,
        configured.NEXCONN_APP_SECRET!,
        (configured.NEXCONN_REGION || 'SG') as 'SG' | 'NA' | 'SA',
      );
      await provider.deleteGroup(provider.groupReference(s.matchId)).catch(() => {
        throw new Error('Could not clean up the owned demo chat group');
      });
    }
    for (const actor of actors) {
      await actor.context.close();
      await copyFile(await actor.video.path(), resolve(output, 'source', `${actor.name}.webm`));
    }
  }
});
