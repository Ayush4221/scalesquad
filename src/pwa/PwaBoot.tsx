'use client';
import { pwaStrings } from '@/constants/strings/pwa';

import { layoutClassName } from '@/styles/layout';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useInstallPrompt } from './useInstallPrompt';
import { Button } from '@/components/ui/button';
export function PwaBoot() {
  const pathname = usePathname();
  const updatePending = useRef(false);
  const reload = useRef<(() => void) | null>(null);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null),
    [offline, setOffline] = useState(false),
    install = useInstallPrompt();
  useEffect(() => {
    const status = () => setOffline(!navigator.onLine);
    status();
    window.addEventListener('online', status);
    window.addEventListener('offline', status);
    let stopped = false;
    const cleanup: (() => void)[] = [];
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator)
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          if (stopped) return;
          if (reg.waiting) setWaiting(reg.waiting);
          const found = () => {
            if (stopped) return;
            const worker = reg.installing;
            const changed = () => {
              if (!stopped && worker?.state === 'installed' && navigator.serviceWorker.controller)
                setWaiting(worker);
            };
            if (worker) {
              worker.addEventListener('statechange', changed);
              cleanup.push(() => worker.removeEventListener('statechange', changed));
              changed();
            }
          };
          reg.addEventListener('updatefound', found);
          cleanup.push(() => reg.removeEventListener('updatefound', found));
          found();
        })
        .catch(() => {
          /* Gameplay works without installation. */
        });
    return () => {
      stopped = true;
      cleanup.forEach((remove) => remove());
      if (reload.current)
        navigator.serviceWorker.removeEventListener('controllerchange', reload.current);
      reload.current = null;
      updatePending.current = false;
      window.removeEventListener('online', status);
      window.removeEventListener('offline', status);
    };
  }, []);
  function update() {
    if (!waiting || updatePending.current) return;
    updatePending.current = true;
    const changed = () => window.location.reload();
    reload.current = changed;
    navigator.serviceWorker.addEventListener('controllerchange', changed, {
      once: true,
    });
    try {
      waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch {
      navigator.serviceWorker.removeEventListener('controllerchange', changed);
      reload.current = null;
      updatePending.current = false;
    }
  }
  return (
    <>
      {offline && (
        <div className={layoutClassName('pwa-banner')} role="status">
          {pwaStrings.offlineReconnectToSyncYourSquad}
        </div>
      )}
      {waiting && (
        <div className={layoutClassName('pwa-banner')} role="status">
          {pwaStrings.updateAvailable}
          <Button onClick={update}>{pwaStrings.reload}</Button>
        </div>
      )}
      {install.canInstall && pathname !== '/' && (
        <div className={layoutClassName('pwa-banner')}>
          <span>
            {install.ios ? pwaStrings.installTapShareThenAddTo : pwaStrings.keepYourSquadOneTapAway}
          </span>
          {!install.ios && (
            <Button onClick={() => void install.promptInstall()}>{pwaStrings.install}</Button>
          )}
          <Button variant="ghost" onClick={install.dismiss}>
            {pwaStrings.dismiss}
          </Button>
        </div>
      )}
    </>
  );
}
