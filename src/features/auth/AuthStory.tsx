import { Database, Server, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import styles from './auth.module.css';

const roles = [
  { name: 'Traffic', description: 'Follow the surge', icon: Server },
  { name: 'Data', description: 'Protect the data', icon: Database },
  { name: 'Operations', description: 'Keep it running', icon: Settings },
];

export function AuthStory({ variant }: { variant: 'signup' | 'login' }) {
  const login = variant === 'login';
  return (
    <div className={styles.storyContent}>
      <p className={styles.eyebrow}>Three players. One mission.</p>
      <h2 className={cn(styles.storyHeading, login && styles.loginStoryHeading)}>
        {login ? (
          <>
            Same squad.
            <br />
            New incident.
            <br />
            <span>Welcome back.</span>
          </>
        ) : (
          <>
            Big failures.
            <br />
            Better <span>teamwork.</span>
          </>
        )}
      </h2>
      <p className={styles.storyDescription}>
        {login
          ? 'Trade clues. Repair the system. Prove your fix works together.'
          : 'Trade clues, repair the system, and prove your fix works.'}
      </p>
      <ul className={styles.roles} aria-label="Your squad’s three roles">
        {roles.map(({ name, description, icon: Icon }) => (
          <li className={styles.role} key={name}>
            <Icon className={styles.roleIcon} strokeWidth={1.5} aria-hidden="true" />
            <strong>{name}</strong>
            <span>{description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
