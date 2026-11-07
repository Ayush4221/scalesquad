import { redirect } from 'next/navigation';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { getCurrentUser } from '@/auth';
import { PlayLobby } from '@/features/lobby/PlayLobby';
import { SignOutButton } from '@/features/auth/SignOutButton';
import { AccountSettings } from '@/features/auth/AccountSettings';
import styles from '@/features/lobby/dashboard.module.css';
export default async function Play() {
  const user = await getCurrentUser();
  if (!user) redirect('/signin');
  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <BrandLogo />
        <div className={styles.account}>
          <AccountSettings />
          <SignOutButton />
        </div>
      </header>
      <PlayLobby name={user.name} />
    </main>
  );
}
