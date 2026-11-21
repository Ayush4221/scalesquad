import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PwaBoot } from '../../src/pwa/PwaBoot';
import { NotificationSettings } from '../../src/pwa/NotificationSettings';
import { disableNotifications, purgeCaches } from '../../src/pwa/client';
import { deferred } from '../helpers/deferred';
const route = vi.hoisted(() => ({ pathname: '/play' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  localStorage.clear();
  route.pathname = '/play';
});
function browser() {
  const unsubscribe = vi.fn(async () => true),
    subscription = {
      endpoint: 'https://fcm.googleapis.com/test',
      unsubscribe,
      toJSON: () => ({ keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } }),
    };
  const pushManager = {
    getSubscription: vi.fn(async () => null as typeof subscription | null),
    subscribe: vi.fn(async () => subscription),
  };
  const worker = {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      state: 'installed',
    },
    events: Record<string, () => void> = {};
  const registration = {
    waiting: worker,
    installing: worker,
    pushManager,
    addEventListener: vi.fn((type: string, fn: () => void) => {
      events[type] = fn;
    }),
    removeEventListener: vi.fn(),
  };
  const serviceWorker = {
    controller: worker,
    getRegistration: vi.fn(async () => registration),
    register: vi.fn(async () => registration),
    ready: Promise.resolve(registration),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const permission = {
    permission: 'default' as NotificationPermission,
    requestPermission: vi.fn(async () => 'granted' as NotificationPermission),
  };
  const mockNavigator = { userAgent: 'test', onLine: true, serviceWorker, standalone: true };
  vi.stubGlobal('navigator', mockNavigator);
  vi.stubGlobal('Notification', permission);
  vi.stubGlobal('PushManager', function () {});
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as MediaQueryList);
  const fetch = vi.fn(
    async (_url: RequestInfo | URL, _options?: RequestInit) =>
      new Response(JSON.stringify({ publicKey: 'B'.repeat(87) }), {
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetch);
  return {
    unsubscribe,
    subscription,
    pushManager,
    worker,
    registration,
    serviceWorker,
    events,
    permission,
    mockNavigator,
    fetch,
  };
}
describe('worker lifecycle and explicit notification permissions', () => {
  it('releases a failed update attempt so the user can retry it', async () => {
    const b = browser();
    vi.stubEnv('NODE_ENV', 'production');
    b.worker.postMessage.mockImplementationOnce(() => {
      throw new Error('worker replaced');
    });
    render(<PwaBoot />);
    const reload = await screen.findByRole('button', { name: 'Reload' });
    fireEvent.click(reload);
    fireEvent.click(reload);
    expect(b.worker.postMessage).toHaveBeenCalledTimes(2);
    expect(b.serviceWorker.removeEventListener).toHaveBeenCalledWith(
      'controllerchange',
      expect.any(Function),
    );
  });
  it('ignores registration and browser-status responses after teardown', async () => {
    const b = browser(),
      registration = deferred<typeof b.registration>();
    vi.stubEnv('NODE_ENV', 'production');
    b.serviceWorker.register.mockReturnValueOnce(registration.promise);
    const boot = render(<PwaBoot />);
    boot.unmount();
    await act(async () => {
      registration.resolve(b.registration);
    });
    expect(b.registration.addEventListener).not.toHaveBeenCalled();
    const status = deferred<typeof b.registration>();
    b.serviceWorker.getRegistration.mockReturnValueOnce(status.promise);
    const settings = render(<NotificationSettings />);
    settings.unmount();
    await act(async () => {
      status.resolve(b.registration);
    });
    expect(b.permission.requestPermission).not.toHaveBeenCalled();
  });
  it('does not roll back an existing endpoint when account registration fails', async () => {
    const b = browser();
    b.permission.permission = 'granted';
    b.pushManager.getSubscription.mockResolvedValue(b.subscription);
    b.fetch.mockImplementation(
      async (_url, options) =>
        new Response(JSON.stringify({ publicKey: 'B'.repeat(87) }), {
          status: options?.method === 'POST' ? 500 : 200,
        }),
    );
    render(<NotificationSettings />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enable on this device' }));
    await screen.findByRole('alert');
    expect(b.unsubscribe).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Disable notifications' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Disable notifications' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Disable notifications' })).toBeNull(),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('retains unconfirmed state when a newly created endpoint refuses rollback', async () => {
    const b = browser();
    b.unsubscribe.mockResolvedValueOnce(false);
    b.fetch.mockImplementation(
      async (_url, options) =>
        new Response(JSON.stringify({ publicKey: 'B'.repeat(87) }), {
          status: options?.method === 'POST' ? 500 : 200,
        }),
    );
    render(<NotificationSettings />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enable notifications' }));
    await screen.findByRole('alert');
    expect(screen.getByText(/needs notification sync/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disable notifications' })).toBeEnabled();
  });
  it('cleans a newly created endpoint if registration fails after leaving settings', async () => {
    const b = browser(),
      post = deferred<Response>();
    b.fetch.mockImplementation(async (_url, options) =>
      options?.method === 'POST'
        ? post.promise
        : new Response(JSON.stringify({ publicKey: 'B'.repeat(87) })),
    );
    const view = render(<NotificationSettings />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enable notifications' }));
    await waitFor(() =>
      expect(b.fetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(true),
    );
    view.unmount();
    await act(async () => {
      post.reject(new Error('cancelled'));
    });
    expect(b.unsubscribe).toHaveBeenCalledOnce();
  });
  it('handles an absent installing worker and ignores saved callbacks after teardown', async () => {
    const b = browser();
    vi.stubEnv('NODE_ENV', 'production');
    b.registration.installing = null as unknown as typeof b.worker;
    const view = render(<PwaBoot />);
    await screen.findByRole('button', { name: 'Reload' });
    expect(b.worker.addEventListener).not.toHaveBeenCalled();
    view.unmount();
    act(() => b.events.updatefound!());
    expect(b.worker.addEventListener).not.toHaveBeenCalled();
  });
  it('falls back to direct purge when sending to the worker fails', async () => {
    const b = browser(),
      deleted = vi.fn(async () => true);
    b.worker.postMessage.mockImplementationOnce(() => {
      throw new Error('worker stopped');
    });
    vi.stubGlobal('caches', { keys: async () => ['old'], delete: deleted });
    await purgeCaches();
    expect(deleted).toHaveBeenCalledOnce();
  });
  it('serializes permission taps and keeps a later status read from overwriting successful registration', async () => {
    const b = browser(),
      permission = deferred<NotificationPermission>();
    const initial = deferred<typeof b.subscription | null>();
    b.pushManager.getSubscription.mockReturnValueOnce(initial.promise);
    b.permission.requestPermission.mockReturnValueOnce(permission.promise);
    render(<NotificationSettings />);
    const enable = await screen.findByRole('button', { name: 'Enable notifications' });
    act(() => {
      fireEvent.click(enable);
      fireEvent.click(enable);
    });
    expect(b.permission.requestPermission).toHaveBeenCalledOnce();
    await act(async () => {
      permission.resolve('granted');
    });
    await screen.findByRole('button', { name: 'Disable notifications' });
    await act(async () => {
      initial.resolve(null);
    });
    expect(screen.getByText('Notifications on for this device.')).toBeInTheDocument();
  });
  it('shows an existing endpoint as unconfirmed and reuses it for account registration', async () => {
    const b = browser();
    b.permission.permission = 'granted';
    b.pushManager.getSubscription.mockResolvedValue(b.subscription);
    render(<NotificationSettings />);
    await screen.findByText(/needs notification sync/);
    expect(screen.queryByText('Notifications on for this device.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enable on this device' }));
    await screen.findByText('Notifications on for this device.');
    expect(b.pushManager.subscribe).not.toHaveBeenCalled();
    expect(b.unsubscribe).not.toHaveBeenCalled();
  });
  it('keeps failed rollback visible and lets the next enable repair the same endpoint', async () => {
    const b = browser();
    b.fetch.mockImplementation(
      async (_url, options) =>
        new Response(JSON.stringify({ publicKey: 'B'.repeat(87) }), {
          status: options?.method === 'POST' ? 500 : 200,
        }),
    );
    b.unsubscribe.mockRejectedValueOnce(new Error('storage blocked'));
    render(<NotificationSettings />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enable notifications' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Disable notifications' })).toBeInTheDocument();
    b.pushManager.getSubscription.mockResolvedValue(b.subscription);
    b.fetch.mockResolvedValue(new Response('{}'));
    fireEvent.click(screen.getByRole('button', { name: 'Enable on this device' }));
    await screen.findByText('Notifications on for this device.');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(b.pushManager.subscribe).toHaveBeenCalledOnce();
  });
  it('times out worker readiness, allows retry, and ignores permission completion after unmount', async () => {
    const b = browser(),
      ready = deferred<typeof b.registration>();
    b.serviceWorker.ready = ready.promise;
    const view = render(<NotificationSettings />);
    const enable = await screen.findByRole('button', { name: 'Enable notifications' });
    vi.useFakeTimers();
    fireEvent.click(enable);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10001);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not enable');
    expect(b.pushManager.subscribe).not.toHaveBeenCalled();
    vi.useRealTimers();
    const permission = deferred<NotificationPermission>();
    b.permission.requestPermission.mockReturnValueOnce(permission.promise);
    fireEvent.click(screen.getByRole('button', { name: 'Enable on this device' }));
    view.unmount();
    await act(async () => {
      permission.resolve('granted');
      ready.resolve(b.registration);
    });
    expect(b.pushManager.subscribe).not.toHaveBeenCalled();
  });
  it('does not hide a failed browser unsubscribe after the server accepted removal', async () => {
    const b = browser();
    b.pushManager.getSubscription.mockResolvedValue(b.subscription);
    b.unsubscribe.mockResolvedValueOnce(false);
    await expect(disableNotifications()).rejects.toThrow('Could not disable');
    await expect(disableNotifications()).resolves.toBeUndefined();
  });
  it('removes worker listeners on teardown and sends an update request only once', async () => {
    const b = browser();
    vi.stubEnv('NODE_ENV', 'production');
    const view = render(<PwaBoot />);
    const reload = await screen.findByRole('button', { name: 'Reload' });
    act(() => {
      fireEvent.click(reload);
      fireEvent.click(reload);
    });
    expect(b.worker.postMessage).toHaveBeenCalledOnce();
    view.unmount();
    expect(b.registration.removeEventListener).toHaveBeenCalledWith(
      'updatefound',
      expect.any(Function),
    );
    expect(b.worker.removeEventListener).toHaveBeenCalledWith('statechange', expect.any(Function));
    expect(b.serviceWorker.removeEventListener).toHaveBeenCalledWith(
      'controllerchange',
      expect.any(Function),
    );
  });
  it('keeps the first-visit home clear of install prompts and offers them in the app', async () => {
    const b = browser();
    route.pathname = '/';
    b.mockNavigator.userAgent = 'iPhone';
    b.mockNavigator.standalone = false;
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as MediaQueryList);
    const view = render(<PwaBoot />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    route.pathname = '/play';
    view.rerender(<PwaBoot />);
    expect(await screen.findByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });
  it('registration and optional notification-status failures leave gameplay available', async () => {
    const b = browser();
    vi.stubEnv('NODE_ENV', 'production');
    b.serviceWorker.register.mockRejectedValueOnce(new Error('worker unavailable'));
    render(<PwaBoot />);
    await waitFor(() => expect(b.serviceWorker.register).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });
    cleanup();
    b.fetch.mockRejectedValueOnce(new Error('key unavailable'));
    b.serviceWorker.getRegistration.mockRejectedValueOnce(new Error('storage blocked'));
    render(<NotificationSettings />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Notifications are unavailable.')).toBeInTheDocument();
    expect(b.permission.requestPermission).not.toHaveBeenCalled();
  });
  it('already-granted permission enables this device only from a tap', async () => {
    const b = browser();
    b.permission.permission = 'granted';
    render(<NotificationSettings />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enable on this device' }));
    await screen.findByRole('button', { name: 'Disable notifications' });
    expect(b.pushManager.subscribe).toHaveBeenCalledOnce();
  });
  it('cache purge works when there is no worker or service-worker support', async () => {
    vi.stubGlobal('navigator', { userAgent: 'test' });
    const deleted = vi.fn(async (_name: string) => true);
    vi.stubGlobal('caches', { keys: async () => ['old'], delete: deleted });
    await purgeCaches();
    await disableNotifications();
    expect(deleted).toHaveBeenCalledWith('old');
    const b = browser();
    b.serviceWorker.controller = null as unknown as typeof b.worker;
    b.serviceWorker.getRegistration.mockResolvedValueOnce(
      undefined as unknown as typeof b.registration,
    );
    await purgeCaches();
    expect(b.worker.postMessage).not.toHaveBeenCalled();
  });
  it('registers only in production, advertises a waiting update and waits for a tap', async () => {
    const b = browser();
    vi.stubEnv('NODE_ENV', 'production');
    render(<PwaBoot />);
    await screen.findByText('Update available.');
    expect(b.worker.postMessage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(b.worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    cleanup();
    b.serviceWorker.register.mockClear();
    vi.stubEnv('NODE_ENV', 'development');
    render(<PwaBoot />);
    expect(b.serviceWorker.register).not.toHaveBeenCalled();
    b.mockNavigator.onLine = false;
    fireEvent(window, new Event('offline'));
    expect(screen.getByRole('status')).toHaveTextContent('Offline');
    b.mockNavigator.onLine = true;
    fireEvent(window, new Event('online'));
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('recognizes a newly installed waiting update', async () => {
    const b = browser();
    b.registration.waiting = null as unknown as typeof b.worker;
    vi.stubEnv('NODE_ENV', 'production');
    render(<PwaBoot />);
    await waitFor(() => expect(b.events.updatefound).toBeDefined());
    act(() => b.events.updatefound!());
    const changed = b.worker.addEventListener.mock.calls[0]![1] as () => void;
    act(() => changed());
    expect(await screen.findByText('Update available.')).toBeInTheDocument();
  });
  it('iOS install guidance and blocked local storage are harmless', () => {
    vi.stubGlobal('navigator', { userAgent: 'iPhone', onLine: true, standalone: false });
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as MediaQueryList);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<PwaBoot />);
    expect(screen.getByText(/tap Share/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/tap Share/)).toBeNull();
  });
  it('permission is requested only on a tap; subscription is registered and can be disabled', async () => {
    const b = browser();
    render(<NotificationSettings />);
    const enable = await screen.findByRole('button', { name: 'Enable notifications' });
    expect(b.permission.requestPermission).not.toHaveBeenCalled();
    fireEvent.click(enable);
    const disable = await screen.findByRole('button', { name: 'Disable notifications' });
    expect(b.permission.requestPermission).toHaveBeenCalledOnce();
    expect(b.pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    b.pushManager.getSubscription.mockResolvedValue(b.subscription);
    fireEvent.click(disable);
    await waitFor(() => expect(b.unsubscribe).toHaveBeenCalledOnce());
    expect(
      b.fetch.mock.calls.some(
        ([url, options]) => url === '/api/game/push/subscription' && options?.method === 'DELETE',
      ),
    ).toBe(true);
  });
  it('rolls back a browser subscription when server registration fails', async () => {
    const b = browser();
    b.fetch.mockImplementation(
      async (_url, options) =>
        new Response(JSON.stringify({ publicKey: 'B'.repeat(87) }), {
          status: options?.method === 'POST' ? 500 : 200,
        }),
    );
    render(<NotificationSettings />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enable notifications' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not enable');
    expect(b.unsubscribe).toHaveBeenCalledOnce();
  });
  it('denied permission never subscribes; uninstalled browsers see no prompt', async () => {
    const b = browser();
    b.permission.requestPermission.mockResolvedValue('denied');
    render(<NotificationSettings />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enable notifications' }));
    await screen.findByText(/Notifications blocked/);
    expect(b.pushManager.subscribe).not.toHaveBeenCalled();
    cleanup();
    b.mockNavigator.standalone = false;
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as MediaQueryList);
    render(<NotificationSettings />);
    expect(screen.queryByRole('button', { name: 'Enable notifications' })).toBeNull();
  });
  it('device removal is owner-bound and refuses to hide failures', async () => {
    const b = browser();
    await disableNotifications();
    expect(b.fetch).not.toHaveBeenCalled();
    b.pushManager.getSubscription.mockResolvedValue(b.subscription);
    b.fetch.mockResolvedValueOnce(new Response('{}', { status: 500 }));
    await expect(disableNotifications()).rejects.toThrow();
    expect(b.unsubscribe).not.toHaveBeenCalled();
  });
  it('logout PURGE waits for worker acknowledgment and clears all static caches', async () => {
    const b = browser();
    const deleted = vi.fn(async (_name: string) => true);
    vi.stubGlobal('caches', { keys: async () => ['old', 'new'], delete: deleted });
    b.worker.postMessage.mockImplementation((_message, ports) => {
      ports[0].postMessage({ ok: true });
    });
    await purgeCaches();
    expect(b.worker.postMessage).toHaveBeenCalledWith({ type: 'PURGE' }, expect.any(Array));
    expect(deleted.mock.calls.map((c) => c[0])).toEqual(['old', 'new']);
  });
});
