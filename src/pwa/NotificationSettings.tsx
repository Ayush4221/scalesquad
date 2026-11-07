'use client';
import { pwaStrings } from '@/constants/strings/pwa';

import { layoutClassName } from '@/styles/layout';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import { isStandalone } from './useInstallPrompt';
import { disableNotifications } from './client';
export function NotificationSettings() {
  const [available, setAvailable] = useState(false),
    [permission, setPermission] = useState<NotificationPermission>('default'),
    [enabled, setEnabled] = useState(false),
    [key, setKey] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let stopped = false;
    if (
      !isStandalone() ||
      !('Notification' in window) ||
      !('PushManager' in window) ||
      !('serviceWorker' in navigator)
    )
      return;
    setAvailable(true);
    setPermission(Notification.permission);
    void api<{ publicKey: string }>('/push/key')
      .then((value) => {
        if (!stopped) setKey(value.publicKey);
      })
      .catch(() => {});
    void navigator.serviceWorker
      .getRegistration()
      .then(async (reg) => {
        const subscription = await reg?.pushManager.getSubscription();
        if (!stopped) setEnabled(Boolean(subscription));
      })
      .catch(() => {});
    return () => {
      stopped = true;
    };
  }, []);
  async function enable() {
    setBusy(true);
    setError('');
    try {
      const granted = await Notification.requestPermission();
      setPermission(granted);
      if (granted !== 'granted') return;
      const registration = await navigator.serviceWorker.ready;
      const decoded = atob(key.replace(/-/g, '+').replace(/_/g, '/')),
        bytes = new Uint8Array(new ArrayBuffer(decoded.length));
      for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes,
        }),
        json = subscription.toJSON();
      try {
        await api('/push/subscription', { endpoint: subscription.endpoint, keys: json.keys });
      } catch (error) {
        await subscription.unsubscribe();
        throw error;
      }
      setEnabled(true);
    } catch {
      setError(pwaStrings.couldNotEnableNotificationsTryAgain);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3">
      <h3 className="font-bold">{pwaStrings.squadNotifications}</h3>
      <p className={layoutClassName('muted text-sm')}>
        {!available
          ? pwaStrings.installScalesquadOnYourHomeScreen
          : !key
            ? pwaStrings.notificationsAreUnavailable
            : permission === 'denied'
              ? pwaStrings.notificationsBlockedChangeThisInYour
              : enabled
                ? pwaStrings.notificationsOnForThisDevice
                : pwaStrings.getANudgeWhenYourSquad}
      </p>
      {available && key && permission === 'default' && (
        <Button disabled={busy} onClick={() => void enable()}>
          {pwaStrings.enableNotifications}
        </Button>
      )}
      {available && key && permission === 'granted' && !enabled && (
        <Button disabled={busy} onClick={() => void enable()}>
          {pwaStrings.enableOnThisDevice}
        </Button>
      )}
      {enabled && (
        <Button
          disabled={busy}
          variant="outline"
          onClick={() =>
            void (async () => {
              setBusy(true);
              try {
                await disableNotifications();
                setEnabled(false);
              } catch {
                setError(pwaStrings.disableNotificationsFailure);
              } finally {
                setBusy(false);
              }
            })()
          }
        >
          {pwaStrings.disableNotifications}
        </Button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
