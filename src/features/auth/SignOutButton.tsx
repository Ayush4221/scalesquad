'use client';
import { authStrings } from '@/constants/strings/auth';

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
              if (!response.ok && response.status !== 401)
                throw new Error(authStrings.logoutFailed);
              // Cache Storage may be blocked by browser privacy settings. The
              // session is already revoked; still leave the signed-in page.
              await purgeCaches().catch(() => {});
              window.location.assign('/signin');
            } catch {
              setError(authStrings.couldNotSignOutTryAgain);
            } finally {
              setBusy(false);
            }
          })()
        }
      >
        {all ? authStrings.signOutEverywhere : authStrings.signOut}
      </Button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
