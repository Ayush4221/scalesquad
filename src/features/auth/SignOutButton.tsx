'use client';
import { authStrings } from '@/constants/strings/auth';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { disableNotifications, purgeCaches } from '@/pwa/client';
import { useHydrated } from '@/hooks/useHydrated';
import { withDeadline } from '@/utils/deadline';
import { lifecyclePolicy } from '@/constants/lifecycle';
export function SignOutButton({ all = false }: { all?: boolean }) {
  const hydrated = useHydrated();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <Button
        variant="ghost"
        disabled={!hydrated || busy}
        onClick={() =>
          void (async () => {
            if (!hydrated || pending.current) return;
            pending.current = true;
            setBusy(true);
            setError('');
            try {
              await withDeadline(
                disableNotifications({
                  signal: AbortSignal.timeout(lifecyclePolicy.optionalLogoutCleanupMs),
                }),
                lifecyclePolicy.optionalLogoutCleanupMs,
              ).catch(() => {});
              const response = await fetch(`/api/game/auth/${all ? 'logout-all' : 'logout'}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}',
                signal: AbortSignal.timeout(30000),
              });
              if (!response.ok && response.status !== 401)
                throw new Error(authStrings.logoutFailed);
              // Cache Storage may be blocked by browser privacy settings. The
              // session is already revoked; still leave the signed-in page.
              await withDeadline(purgeCaches(), lifecyclePolicy.optionalLogoutCleanupMs).catch(
                () => {},
              );
              window.location.assign('/signin');
            } catch {
              setError(authStrings.couldNotSignOutTryAgain);
            } finally {
              pending.current = false;
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
