'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useInstallPrompt } from './useInstallPrompt';
import { Button } from '@/components/ui/button';
export function PwaBoot() {
  const pathname = usePathname();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null),
    [offline, setOffline] = useState(false),
    install = useInstallPrompt();
  useEffect(() => {
    const status = () => setOffline(!navigator.onLine);
    status();
    window.addEventListener('online', status);
    window.addEventListener('offline', status);
    let stopped = false;
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator)
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          if (stopped) return;
          if (reg.waiting) setWaiting(reg.waiting);
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing;
            worker?.addEventListener('statechange', () => {
              if (!stopped && worker.state === 'installed' && navigator.serviceWorker.controller)
                setWaiting(worker);
            });
          });
        })
        .catch(() => {
          /* Gameplay works without installation. */
        });
    return () => {
      stopped = true;
      window.removeEventListener('online', status);
      window.removeEventListener('offline', status);
    };
  }, []);
  function update() {
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
      once: true,
    });
    waiting?.postMessage({ type: 'SKIP_WAITING' });
  }
  return (
    <>
      {offline && (
        <div className="pwa-banner" role="status">
          Offline · Reconnect to sync your squad.
        </div>
      )}
      {waiting && (
        <div className="pwa-banner" role="status">
          Update available. <Button onClick={update}>Reload</Button>
        </div>
      )}
      {install.canInstall && pathname !== '/' && (
        <div className="pwa-banner">
          <span>
            {install.ios
              ? 'Install: tap Share ↑, then Add to Home Screen ⊞.'
              : 'Keep your squad one tap away.'}
          </span>
          {!install.ios && <Button onClick={() => void install.promptInstall()}>Install</Button>}
          <Button variant="ghost" onClick={install.dismiss}>
            Dismiss
          </Button>
        </div>
      )}
    </>
  );
}
