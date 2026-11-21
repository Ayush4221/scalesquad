import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { test, expect, lobby, acknowledge, referenceRepair } from '../e2e/fixtures';
import { localBaseURL } from '../e2e/settings';

const output = resolve('../ScaleSquad-Submission-2026-11-14');
test('capture the real cooperative game for submission', async ({ squad: s, browser }) => {
  for (const folder of ['screenshots-original', 'screenshots-polished', 'source', 'video'])
    await mkdir(resolve(output, folder), { recursive: true });
  for (const [index, name] of ['Alex', 'Maya', 'Jordan'].entries()) {
    const player = s.players[index]!;
    await s.db.user.update({ where: { id: player.id }, data: { name } });
    player.name = name;
    await player.page.setViewportSize({ width: 1600, height: 900 });
  }
  const originalHost = s.players[0];
  const cookies = await originalHost.context.cookies();
  const context = await browser.newContext({
    baseURL: localBaseURL,
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: resolve('.cache/submission-capture/video'),
      size: { width: 1600, height: 900 },
    },
    serviceWorkers: 'block',
  });
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === localBaseURL ? route.continue() : route.abort(),
  );
  await context.routeWebSocket(/wss:\/\/.*/, (socket) => socket.close());
  const page = await context.newPage(),
    began = Date.now(),
    video = page.video()!;
  const chapters: {
    id: string;
    start: number;
    end: number;
    crop: { x: number; y: number; width: number; height: number };
  }[] = [];
  const seconds = () => (Date.now() - began) / 1000;
  async function scroll(target: Locator) {
    await target.evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    await page.waitForTimeout(1100);
    await page.evaluate(() => window.scrollBy(0, -64));
  }
  async function still(name: string, target?: Locator, owner: Page = page) {
    await owner.evaluate(() => document.fonts.ready);
    if (target)
      await target.screenshot({
        path: resolve(output, 'screenshots-original', `${name}.png`),
        animations: 'disabled',
        style: '.status-bar { visibility: hidden !important; }',
      });
    else
      await owner.screenshot({
        path: resolve(output, 'screenshots-original', `${name}.png`),
        animations: 'disabled',
      });
  }
  async function hold(id: string, target?: Locator, duration = 5) {
    if (target) await scroll(target);
    await page.mouse.move(1580, 880);
    await page.waitForTimeout(600);
    const bounds = target ? await target.boundingBox() : null;
    const crop = bounds
      ? {
          x: Math.max(0, Math.floor(bounds.x) - 16),
          y: 0,
          width: Math.min(
            1600 - Math.max(0, Math.floor(bounds.x) - 16),
            Math.ceil(bounds.width) + 32,
          ),
          height: 900,
        }
      : { x: 0, y: 0, width: 1600, height: 900 };
    const start = seconds();
    await page.waitForTimeout(duration * 1000);
    chapters.push({ id, start, end: seconds(), crop });
  }
  try {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await still('01-home');
    await hold('01-intro', undefined, 6);
    await context.addCookies(cookies);
    await originalHost.context.close();
    s.players[0] = { ...originalHost, context, page };
    await lobby(s);
    for (const player of s.players) {
      const response = player.page.waitForResponse(
        (r) => r.url().endsWith(`/matches/${s.matchId}/ready`) && r.request().method() === 'POST',
      );
      await player.page.getByRole('button', { name: 'Ready up', exact: true }).click();
      expect((await response).ok()).toBe(true);
      await expect(
        player.page.getByRole('button', { name: 'Not ready', exact: true }),
      ).toBeEnabled();
    }
    const squad = page.locator('section[aria-labelledby="control-room-title"]');
    await still('02-squad-ready', squad);
    await hold('02-squad', squad, 6);
    await page.getByRole('button', { name: 'Start match', exact: true }).click();
    await expect(page.locator('.status-bar')).toContainText('BRIEFING');
    await expect(page.locator('.tab-brief')).toContainText(/opening brief/i);
    for (const player of s.players) {
      const owner = player.page;
      await expect(owner.locator('.tab-brief')).toContainText(/opening brief/i);
      const view = (await (
        await player.context.request.get(`/api/game/matches/${s.matchId}`)
      ).json()) as { ownRole: string };
      const role = view.ownRole === 'OPS' ? 'operations' : view.ownRole.toLowerCase();
      await still(`03-${role}-evidence`, owner.locator('.tab-brief'), owner);
    }
    await hold('03-evidence', page.locator('.tab-brief'), 6);
    await acknowledge(s);
    await expect(page.locator('.status-bar')).toContainText(/REPAIR[ _]1/);
    await still('04-repair-console', page.locator('.tab-repair'));
    await hold('04-editor', page.locator('.tab-repair'), 6);
    await page.getByRole('button', { name: 'Run baseline + incident' }).click();
    await expect(page.getByRole('button', { name: 'Reveal incident evidence' })).toBeEnabled({
      timeout: 30000,
    });
    const incident = page.locator('.tab-results .run-grid [data-slot="card"]').nth(1);
    await still('05-incident-failure', incident);
    await hold('05-baseline', incident, 6);
    await page.getByRole('button', { name: 'Reveal incident evidence' }).click();
    await expect(page.locator('.status-bar')).toContainText(/INCIDENT[ _]EVIDENCE/);
    await expect(page.locator('.tab-brief')).toContainText(/incident update/i);
    await still('06-new-evidence', page.locator('.tab-brief'));
    await hold('06-incident', page.locator('.tab-brief'), 6);
    await acknowledge(s);
    await scroll(page.locator('.tab-repair'));
    const editStart = seconds();
    const editBounds = (await page.locator('.tab-repair').boundingBox())!;
    await referenceRepair(s);
    await page.waitForTimeout(2500);
    chapters.push({
      id: '07-repair',
      start: editStart,
      end: seconds(),
      crop: {
        x: Math.floor(editBounds.x) - 16,
        y: 0,
        width: Math.ceil(editBounds.width) + 32,
        height: 900,
      },
    });
    await still('07-repaired-design', page.locator('.tab-repair'));
    await page.getByRole('button', { name: 'Run repair' }).click();
    await expect(page.locator('.status-bar')).toContainText('COMPARE', { timeout: 30000 });
    const comparison = page.locator('.tab-results [data-slot="card"]').first();
    await expect(comparison).toContainText('Same incident. A different design.');
    await expect(comparison).toContainText('PASSED');
    await still('08-before-after-comparison', comparison);
    await hold('08-comparison', comparison, 8);
    const phone = await browser.newContext({
      baseURL: localBaseURL,
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
      storageState: await context.storageState(),
      recordVideo: {
        dir: resolve('.cache/submission-capture/phone'),
        size: { width: 430, height: 932 },
      },
      serviceWorkers: 'block',
    });
    await phone.route('**/*', (route) =>
      new URL(route.request().url()).origin === localBaseURL ? route.continue() : route.abort(),
    );
    await phone.routeWebSocket(/wss:\/\/.*/, (socket) => socket.close());
    const mobile = await phone.newPage(),
      phoneVideo = mobile.video()!,
      phoneBegan = Date.now();
    await mobile.goto(`/match/${s.matchId}`);
    await mobile
      .getByRole('navigation', { name: 'Match sections' })
      .getByRole('button', { name: 'Results', exact: true })
      .click();
    await mobile.getByText('Same incident. A different design.').scrollIntoViewIfNeeded();
    await still('09-mobile-web-results', undefined, mobile);
    const phoneStart = (Date.now() - phoneBegan) / 1000;
    await mobile.waitForTimeout(6000);
    await phone.close();
    await copyFile(await phoneVideo.path(), resolve(output, 'source/mobile.webm'));
    await writeFile(
      resolve(output, 'source/mobile.json'),
      JSON.stringify({ start: phoneStart, duration: 6, width: 430, height: 932 }, null, 2),
    );
    await page.getByRole('button', { name: 'Finish match', exact: true }).click();
    await expect(page.locator('.status-bar')).toContainText('FINISHED');
    await still('10-match-complete', comparison);
    await hold('10-outro', comparison, 6);
    const result = (await (await context.request.get(`/api/game/matches/${s.matchId}`)).json()) as {
      runs: unknown[];
      comparison: unknown;
      scenario: { title: string };
    };
    await writeFile(
      resolve(output, 'source/game-result.json'),
      JSON.stringify(
        { scenario: result.scenario.title, runs: result.runs, comparison: result.comparison },
        null,
        2,
      ),
    );
    await writeFile(resolve(output, 'source/chapters.json'), JSON.stringify(chapters, null, 2));
  } finally {
    await context.close();
    await copyFile(await video.path(), resolve(output, 'source/gameplay.webm'));
  }
});
