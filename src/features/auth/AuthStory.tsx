import { cn } from '@/lib/utils';
import { AuthRoleCards } from './AuthRoleCards';
import styles from './auth.module.css';
import motion from './login.module.css';

export function AuthStory({ variant }: { variant: 'signup' | 'login' }) {
  const login = variant === 'login';
  return (
    <div className={cn(styles.storyContent, login && motion.story)}>
      <p className={styles.eyebrow}>Three players. One mission.</p>
      <h2 className={cn(styles.storyHeading, login && styles.loginStoryHeading)}>
        {login ? (
          <>
            <span className={motion.line}>Same squad.</span>
            <span className={motion.line}>New incident.</span>
            <span className={motion.line}>Welcome back.</span>
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
          ? 'Trade clues. Beat the incident. Prove your fix works together.'
          : 'Trade clues, repair the system, and prove your fix works.'}
      </p>
      <AuthRoleCards animated={login} />
    </div>
  );
}
