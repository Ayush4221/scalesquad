import { Check, X } from 'lucide-react';
import { getPasswordRequirements, PASSWORD_MIN_LENGTH } from '@scalesquad/shared';
import styles from './PasswordRequirements.module.css';

const requirements = [
  { key: 'minLength', label: `At least ${PASSWORD_MIN_LENGTH} characters` },
  { key: 'uppercase', label: 'At least one uppercase letter' },
  { key: 'special', label: 'At least one special character' },
  { key: 'number', label: 'At least one number' },
] as const;

export function PasswordRequirements({ password, id }: { password: string; id: string }) {
  const satisfied = getPasswordRequirements(password);
  return (
    <div className={styles.requirements} id={id}>
      <p className={styles.heading}>Password requirements:</p>
      <ul className={styles.list} aria-label="Password requirements" aria-live="polite">
        {requirements.map(({ key, label }) => {
          const met = satisfied[key];
          const Icon = met ? Check : X;
          return (
            <li key={key} className={met ? styles.met : styles.unmet}>
              <Icon aria-hidden="true" />
              <span className="sr-only">{met ? 'Met: ' : 'Not met: '}</span>
              <span>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
