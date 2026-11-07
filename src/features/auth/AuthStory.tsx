import { authStrings } from '@/constants/strings/auth';
import { cn } from '@/utils/classNames';
import { AuthRoleCards } from './AuthRoleCards';
import styles from './auth.module.css';
import motion from './login.module.css';

export function AuthStory({ variant }: { variant: 'signup' | 'login' }) {
  const login = variant === 'login';
  return (
    <div className={cn(styles.storyContent, login && motion.story)}>
      <p className={styles.eyebrow}>{authStrings.threePlayersOneMission}</p>
      <h2 className={cn(styles.storyHeading, login && styles.loginStoryHeading)}>
        {login ? (
          <>
            <span className={motion.line}>{authStrings.sameSquad}</span>
            <span className={motion.line}>{authStrings.newIncident}</span>
            <span className={motion.line}>{authStrings.welcomeBack}</span>
          </>
        ) : (
          <>
            {authStrings.bigFailures}
            <br />
            {authStrings.better}
            <span>{authStrings.teamwork}</span>
          </>
        )}
      </h2>
      <p className={styles.storyDescription}>
        {login
          ? authStrings.tradeCluesBeatTheIncidentProve
          : authStrings.tradeCluesRepairTheSystemAnd}
      </p>
      <AuthRoleCards animated={login} />
    </div>
  );
}
