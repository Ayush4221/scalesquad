'use client';
import { pwaStrings } from '@/constants/strings/pwa';
import { lifecyclePolicy } from '@/constants/lifecycle';
import { layoutClassName } from '@/styles/layout';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import { withDeadline } from '@/utils/deadline';
import { isStandalone } from './useInstallPrompt';
import { disableNotifications } from './client';

type SubscriptionState = 'off' | 'unconfirmed' | 'registered';
type Operation = 'idle' | 'enabling' | 'disabling';
interface Lifetime {
  controller: AbortController;
  operation: Operation;
  version: number;
}

export function NotificationSettings() {
  const owner = useRef<Lifetime | null>(null);
  const [available, setAvailable] = useState(false),
    [permission, setPermission] = useState<NotificationPermission>('default'),
    [subscription, setSubscription] = useState<SubscriptionState>('off'),
    [key, setKey] = useState(''),
    [operation, setOperation] = useState<Operation>('idle'),
    [error, setError] = useState('');
  const owns = (current: Lifetime) =>
    owner.current === current && !current.controller.signal.aborted;
  useEffect(() => {
    const current: Lifetime = { controller: new AbortController(), operation: 'idle', version: 0 };
    owner.current = current;
    if (
      isStandalone() &&
      'Notification' in window &&
      'PushManager' in window &&
      'serviceWorker' in navigator
    ) {
      setAvailable(true);
      setPermission(Notification.permission);
      void api<{ publicKey: string }>('/push/key', undefined, { signal: current.controller.signal })
        .then((value) => {
          if (owns(current)) setKey(value.publicKey);
        })
        .catch(() => {});
      void withDeadline(
        navigator.serviceWorker.getRegistration().then((reg) => reg?.pushManager.getSubscription()),
        lifecyclePolicy.browserReadTimeoutMs,
      )
        .then((value) => {
          // A browser endpoint alone does not prove this account is registered.
          if (owns(current) && current.version === 0)
            setSubscription(value ? 'unconfirmed' : 'off');
        })
        .catch(() => {});
    }
    return () => {
      current.controller.abort();
      if (owner.current === current) owner.current = null;
    };
  }, []);
  async function change(next: Exclude<Operation, 'idle'>) {
    const current = owner.current;
    if (!current || !owns(current) || current.operation !== 'idle') return;
    current.operation = next;
    current.version++;
    setOperation(next);
    setError('');
    try {
      if (next === 'disabling') {
        await disableNotifications({ signal: current.controller.signal });
        if (owns(current)) setSubscription('off');
        return;
      }
      const granted = await Notification.requestPermission();
      if (!owns(current)) return;
      setPermission(granted);
      if (granted !== 'granted') return;
      const registration = await withDeadline(
        navigator.serviceWorker.ready,
        lifecyclePolicy.browserReadTimeoutMs,
      );
      if (!owns(current)) return;
      const decoded = atob(key.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = Uint8Array.from(decoded, (letter) => letter.charCodeAt(0));
      const existing = await registration.pushManager.getSubscription();
      if (!owns(current)) return;
      const device =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes,
        }));
      try {
        if (owns(current)) setSubscription('unconfirmed');
        await api(
          '/push/subscription',
          { endpoint: device.endpoint, keys: device.toJSON().keys },
          { signal: current.controller.signal },
        );
        if (owns(current)) setSubscription('registered');
      } catch (failure) {
        // Preserve an existing endpoint for retry. Roll back only one created here.
        if (!existing) {
          try {
            const removed = await device.unsubscribe();
            if (removed && owns(current)) setSubscription('off');
          } catch {
            /* Unconfirmed remains visible with a cleanup action. */
          }
        }
        throw failure;
      }
    } catch {
      if (owns(current))
        setError(
          next === 'enabling'
            ? pwaStrings.couldNotEnableNotificationsTryAgain
            : pwaStrings.disableNotificationsFailure,
        );
    } finally {
      current.operation = 'idle';
      if (owns(current)) setOperation('idle');
    }
  }
  const busy = operation !== 'idle';
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
              : subscription === 'registered'
                ? pwaStrings.notificationsOnForThisDevice
                : subscription === 'unconfirmed'
                  ? pwaStrings.subscriptionNeedsSync
                  : pwaStrings.getANudgeWhenYourSquad}
      </p>
      {available && key && permission !== 'denied' && subscription !== 'registered' && (
        <Button disabled={busy} onClick={() => void change('enabling')}>
          {permission === 'default'
            ? pwaStrings.enableNotifications
            : pwaStrings.enableOnThisDevice}
        </Button>
      )}
      {subscription !== 'off' && (
        <Button disabled={busy} variant="outline" onClick={() => void change('disabling')}>
          {pwaStrings.disableNotifications}
        </Button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
