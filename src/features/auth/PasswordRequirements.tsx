import { authStrings } from '@/constants/strings/auth';
import { Check, X } from 'lucide-react';
import { getPasswordRequirements, PASSWORD_MIN_LENGTH } from '@scalesquad/shared';
import styles from './PasswordRequirements.module.css';

const requirements = [
  { key: 'minLength', label: authStrings.minimumPasswordLength(PASSWORD_MIN_LENGTH) },
  { key: 'uppercase', label: authStrings.atLeastOneUppercaseLetter },
  { key: 'special', label: authStrings.atLeastOneSpecialCharacter },
  { key: 'number', label: authStrings.atLeastOneNumber },
] as const;

export function PasswordRequirements({ password, id }: { password: string; id: string }) {
  const satisfied = getPasswordRequirements(password);
  return (
    <div className={styles.requirements} id={id}>
      <p className={styles.heading}>{authStrings.passwordRequirements}</p>
      <ul
        className={styles.list}
        aria-label={authStrings.passwordRequirementsLabel}
        aria-live="polite"
      >
        {requirements.map(({ key, label }) => {
          const met = satisfied[key];
          const Icon = met ? Check : X;
          return (
            <li key={key} className={met ? styles.met : styles.unmet}>
              <Icon aria-hidden="true" />
              <span className="sr-only">{met ? authStrings.met : authStrings.notMet}</span>
              <span>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
