import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/auth';
import { PlayLobby } from '@/features/lobby/PlayLobby';
import { SignOutButton } from '@/features/auth/SignOutButton';
import { AccountSettings } from '@/features/auth/AccountSettings';
export default async function Play() {
  const user = await getCurrentUser();
  if (!user) redirect('/signin');
  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="wordmark" href="/play">
          ▦ SCALE<span>SQUAD</span>
        </a>
        <div className="flex gap-2">
          <AccountSettings />
          <SignOutButton />
        </div>
      </header>
      <PlayLobby name={user.name} />
    </main>
  );
}
