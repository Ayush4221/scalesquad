export async function purgeCaches(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const worker = navigator.serviceWorker.controller ?? registration?.active;
      if (worker)
        await new Promise<void>((resolve) => {
          const channel = new MessageChannel();
          const finish = () => {
            clearTimeout(timeout);
            channel.port1.close();
            resolve();
          };
          const timeout = setTimeout(finish, 1000);
          channel.port1.onmessage = finish;
          worker.postMessage({ type: 'PURGE' }, [channel.port2]);
        });
    } catch {
      /* Direct cache removal still runs when worker storage is unavailable. */
    }
  }
  if ('caches' in window) await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
}
export async function disableNotifications(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const subscription = await (
    await navigator.serviceWorker.getRegistration()
  )?.pushManager?.getSubscription();
  if (!subscription) return;
  const response = await fetch('/api/game/push/subscription', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  if (!response.ok) throw new Error('Could not disable notifications');
  await subscription.unsubscribe();
}
