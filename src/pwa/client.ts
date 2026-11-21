import { pwaStrings } from '@/constants/strings/pwa';
import { api } from '@/lib/api/client';
import { withDeadline } from '@/utils/deadline';
import { lifecyclePolicy } from '@/constants/lifecycle';
export async function purgeCaches(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await withDeadline(
        navigator.serviceWorker.getRegistration(),
        lifecyclePolicy.browserReadTimeoutMs,
      );
      const worker = navigator.serviceWorker.controller ?? registration?.active;
      if (worker)
        await new Promise<void>((resolve) => {
          const channel = new MessageChannel();
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            channel.port1.close();
            channel.port2.close();
            resolve();
          };
          const timeout = setTimeout(finish, lifecyclePolicy.workerPurgeAckMs);
          channel.port1.onmessage = finish;
          try {
            worker.postMessage({ type: 'PURGE' }, [channel.port2]);
          } catch {
            finish();
          }
        });
    } catch {
      /* Direct cache removal still runs when worker storage is unavailable. */
    }
  }
  if ('caches' in window) await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
}
export async function disableNotifications(options: { signal?: AbortSignal } = {}): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await withDeadline(
    navigator.serviceWorker.getRegistration(),
    lifecyclePolicy.browserReadTimeoutMs,
  );
  const subscription = await withDeadline(
    Promise.resolve(registration?.pushManager?.getSubscription()),
    lifecyclePolicy.browserReadTimeoutMs,
  );
  if (!subscription) return;
  // Keep the browser endpoint until server removal succeeds, so retry is possible.
  await api(
    '/push/subscription',
    { endpoint: subscription.endpoint },
    { method: 'DELETE', ...options },
  );
  const removed = await subscription.unsubscribe();
  if (!removed && (await registration?.pushManager.getSubscription()))
    throw new Error(pwaStrings.couldNotDisableNotifications);
}
