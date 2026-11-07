'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { disableNotifications, purgeCaches } from '@/pwa/client';
export function SignOutButton({ all = false }: { all?: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <Button
        variant="ghost"
        disabled={busy}
        onClick={() =>
          void (async () => {
            setBusy(true);
            setError('');
            try {
              await disableNotifications().catch(() => {});
              const response = await fetch(`/api/game/auth/${all ? 'logout-all' : 'logout'}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}',
              });
              if (!response.ok && response.status !== 401) throw new Error('logout failed');
              // Cache Storage may be blocked by browser privacy settings. The
              // session is already revoked; still leave the signed-in page.
              await purgeCaches().catch(() => {});
              window.location.assign('/signin');
            } catch {
              setError('Could not sign out. Try again.');
            } finally {
              setBusy(false);
            }
          })()
        }
      >
        {all ? 'Sign out everywhere' : 'Sign out'}
      </Button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
