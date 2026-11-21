import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { BrowserContext, Locator, Page, Video } from '@playwright/test';
import type { ConfigurationValues } from '../../src/shared/domain';
import { test, expect } from '../e2e/fixtures';
import { localBaseURL } from '../e2e/settings';

const output = resolve('../ScaleSquad-Submission-v2-2026-11-14');
interface Actor {
  name: string;
  page: Page;
  context: BrowserContext;
  video: Video;
  began: number;
  clicks: number[];
}
test('record an interactive three-player incident story', async ({ squad: s, browser }) => {
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
    await actor.page.mouse.down();
    await actor.page.waitForTimeout(90);
    await actor.page.mouse.up();
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
        viewport: { width: 960, height: 540 },
        deviceScaleFactor: 2,
        storageState: await original.context.storageState(),
        recordVideo: {
          dir: resolve('.cache/submission-v2/recordings'),
          size: { width: 1920, height: 1080 },
        },
        serviceWorkers: 'block',
      });
      await context.addInitScript(pointerScript);
      await context.route('**/*', (route) =>
        new URL(route.request().url()).origin === localBaseURL ? route.continue() : route.abort(),
      );
      await context.routeWebSocket(/wss:\/\/.*/, (socket) => socket.close());
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
      await expect(actor.page.locator('.tab-brief')).toContainText(/opening brief/i);
      const roleView = (await (
        await actor.context.request.get(`/api/game/matches/${s.matchId}`)
      ).json()) as { ownRole: string };
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
    for (const actor of actors)
      await scene(`ack-${actor.name}`, actor, async () => {
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
        await click(actor, actor.page.getByRole('button', { name: 'I’ve read my evidence' }));
      });
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
    const phoneContext = await browser.newContext({
      baseURL: localBaseURL,
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      storageState: await maya.context.storageState(),
      recordVideo: {
        dir: resolve('.cache/submission-v2/recordings'),
        size: { width: 860, height: 1864 },
      },
      serviceWorkers: 'block',
    });
    await phoneContext.addInitScript(pointerScript);
    await phoneContext.route('**/*', (route) =>
      new URL(route.request().url()).origin === localBaseURL ? route.continue() : route.abort(),
    );
    await phoneContext.routeWebSocket(/wss:\/\/.*/, (socket) => socket.close());
    const phonePage = await phoneContext.newPage();
    const phone: Actor = {
      name: 'Phone',
      page: phonePage,
      context: phoneContext,
      video: phonePage.video()!,
      began: Date.now(),
      clicks: [],
    };
    actors.push(phone);
    await phonePage.goto(`/match/${s.matchId}`);
    await scene('mobile', phone, async () => {
      await click(
        phone,
        phonePage
          .getByRole('navigation', { name: 'Match sections' })
          .getByRole('button', { name: 'Results', exact: true }),
      );
      await focus(phone, phonePage.locator('.tab-results'));
      await phonePage.waitForTimeout(1000);
      await phonePage.evaluate(() => window.scrollBy({ top: 420, behavior: 'smooth' }));
      await phonePage.waitForTimeout(1800);
    });
    await shot(
      '11-complete-mobile-comparison',
      phone,
      phonePage.locator('.tab-results [data-slot="card"]').first(),
    );
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
    for (const actor of actors) {
      await actor.context.close();
      await copyFile(await actor.video.path(), resolve(output, 'source', `${actor.name}.webm`));
    }
  }
});
