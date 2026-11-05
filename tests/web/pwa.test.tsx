import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync, existsSync } from 'node:fs';
import {
  shouldCache,
  oldCache,
  CACHE_NAME,
  pushMessage,
  notificationText,
} from '../../src/pwa/swLogic';
import { isStandalone, useInstallPrompt } from '../../src/pwa/useInstallPrompt';
import manifest from '../../src/app/manifest';
import { ResponsiveSelect } from '../../src/components/shared/ResponsiveSelect';
import { BottomNav } from '../../src/components/shared/MatchNavigation';
import { cn } from '../../src/lib/utils';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});
function media(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  });
}
describe('safe static cache policy', () => {
  const request = (path: string, method = 'GET', mode = 'cors') => ({
    url: `https://game.example${path}`,
    method,
    mode: mode as RequestMode,
  });
  const response = (extra: Record<string, string> = {}) => ({
    status: 200,
    type: 'basic' as ResponseType,
    headers: new Headers(extra),
  });
  it('only immutable assets enter cache', () => {
    for (const path of [
      '/_next/static/chunks/a-hash.js',
      '/icons/icon-192.png',
      '/icons/squad-link.svg',
      '/icons/favicon-32.png',
      '/fonts/mono-hash.woff2',
    ])
      expect(shouldCache(request(path), response(), 'https://game.example')).toBe(true);
    for (const path of [
      '/api/game/me',
      '/icons/unapproved.svg',
      '/api/auth/session',
      '/ws',
      '/match/a',
      '/play',
      '/signin',
      '/register',
      '/match/a/evidence',
      '/match/a/results',
      '/_next/static/a.js?_rsc=x',
    ])
      expect(shouldCache(request(path), response(), 'https://game.example')).toBe(false);
  });
  it('refuses sensitive responses, mutations, foreign origins and navigations', () => {
    const req = request('/_next/static/a.js');
    for (const headers of [
      { 'cache-control': 'no-store' },
      { 'cache-control': 'private' },
      { 'set-cookie': 'session=x' },
      { 'content-type': 'text/html' },
      { 'content-type': 'text/x-component' },
    ])
      expect(shouldCache(req, response(headers), 'https://game.example')).toBe(false);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
      expect(shouldCache({ ...req, method }, response(), 'https://game.example')).toBe(false);
    expect(shouldCache({ ...req, mode: 'navigate' }, response(), 'https://game.example')).toBe(
      false,
    );
    expect(shouldCache(req, { ...response(), status: 404 }, 'https://game.example')).toBe(false);
    expect(shouldCache(req, { ...response(), type: 'opaque' }, 'https://game.example')).toBe(false);
    expect(shouldCache(req, response(), 'https://other.example')).toBe(false);
  });
  it('versions cache and validates content-free notifications', () => {
    expect(oldCache(CACHE_NAME)).toBe(false);
    expect(oldCache('old')).toBe(true);
    for (const kind of Object.keys(notificationText))
      expect(pushMessage({ kind, matchId: 'match-1' })).toEqual({ kind, matchId: 'match-1' });
    for (const message of [
      null,
      {},
      'x',
      { kind: 'UNKNOWN', matchId: 'a' },
      { kind: 'MATCH_STARTED', matchId: '../evil' },
      { kind: 'EVIDENCE_AVAILABLE', matchId: 'a', evidence: 'secret' },
    ])
      expect(pushMessage(message)).toBeNull();
  });
  it('manifest icons exist; offline shell holds no user state', () => {
    const m = manifest();
    expect(m.start_url).toBe('/play');
    expect(m.scope).toBe('/');
    expect(m.display).toBe('standalone');
    expect(m.icons?.map((i) => i.sizes)).toContain('192x192');
    expect(m.icons?.some((i) => i.purpose === 'maskable')).toBe(true);
    for (const icon of m.icons ?? []) expect(existsSync(`public${icon.src}`)).toBe(true);
    const shell = readFileSync('public/offline.html', 'utf8');
    expect(shell).toContain('Reconnect');
    expect(shell).not.toMatch(/token|evidence|userId|password/i);
  });
});
describe('phone controls and installation', () => {
  it('uses drawer controls on a phone; disabled controls cannot change values', () => {
    media(false);
    const change = vi.fn();
    render(
      <ResponsiveSelect
        label="Capacity"
        value="LOW"
        choices={[
          { value: 'LOW', label: 'Low' },
          { value: 'HIGH', label: 'High' },
        ]}
        disabled={false}
        onChange={change}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Capacity' }));
    expect(screen.getByRole('dialog')).toHaveAttribute('data-presentation', 'drawer');
    fireEvent.click(screen.getByRole('button', { name: 'High' }));
    expect(change).toHaveBeenCalledWith('HIGH');
    cleanup();
    render(
      <ResponsiveSelect label="Capacity" value="LOW" choices={[]} disabled onChange={change} />,
    );
    expect(screen.getByRole('button', { name: 'Capacity' })).toBeDisabled();
  });
  it('desktop renders the shared select; bottom nav guards lobby tabs', () => {
    media(true);
    render(
      <ResponsiveSelect
        label="Capacity"
        value="LOW"
        choices={[{ value: 'LOW', label: 'Low' }]}
        disabled={false}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    cleanup();
    render(<BottomNav phase="LOBBY" active="Squad" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'Brief' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Squad' })).toBeEnabled();
  });
  it('standalone combines browser and iOS signals', () => {
    media(false);
    expect(isStandalone()).toBe(false);
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    expect(isStandalone()).toBe(true);
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: false });
    media(true);
    expect(isStandalone()).toBe(true);
  });
  it('install prompt runs only on a tap, once; storage failure is harmless', async () => {
    media(false);
    const prompt = vi.fn(async () => {});
    function Test() {
      const i = useInstallPrompt();
      return (
        <>
          <button disabled={!i.canInstall} onClick={() => void i.promptInstall()}>
            Install
          </button>
          <button onClick={i.dismiss}>Dismiss</button>
        </>
      );
    }
    render(<Test />);
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Install'));
    expect(prompt).toHaveBeenCalledOnce();
    fireEvent(window, new Event('appinstalled'));
    expect(screen.getByText('Install')).toBeDisabled();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    fireEvent.click(screen.getByText('Dismiss'));
  });
  it('merges conditional utility classes and resolves Tailwind conflicts', () => {
    expect(cn('px-2', false && 'hidden', { flex: true }, 'px-4')).toBe('flex px-4');
  });
});
