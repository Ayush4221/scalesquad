'use client';
import { Database, Server, Settings } from 'lucide-react';
import type { PointerEvent } from 'react';
import { cn } from '@/lib/utils';
import styles from './auth.module.css';
import motion from './login.module.css';

const roles = [
  { name: 'Traffic', description: 'Follow the surge', icon: Server },
  { name: 'Data', description: 'Protect the data', icon: Database },
  { name: 'Operations', description: 'Keep it running', icon: Settings },
];

function tilt(event: PointerEvent<HTMLLIElement>) {
  if (
    event.pointerType !== 'mouse' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return;
  const element = event.currentTarget;
  const bounds = element.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width;
  const y = (event.clientY - bounds.top) / bounds.height;
  element.style.setProperty('--role-rotate-x', (0.5 - y) * 10 + 'deg');
  element.style.setProperty('--role-rotate-y', (x - 0.5) * 10 + 'deg');
  element.style.setProperty('--role-light-x', x * 100 + '%');
  element.style.setProperty('--role-light-y', y * 100 + '%');
}

function reset(event: PointerEvent<HTMLLIElement>) {
  event.currentTarget.style.setProperty('--role-rotate-x', '0deg');
  event.currentTarget.style.setProperty('--role-rotate-y', '0deg');
}

export function AuthRoleCards({ animated }: { animated: boolean }) {
  return (
    <div className={animated ? motion.roleStage : undefined}>
      {animated && <span className={motion.connection} aria-hidden="true" />}
      <ul
        className={cn(styles.roles, animated && motion.roles)}
        aria-label="Your squad’s three roles"
      >
        {roles.map(({ name, description, icon: Icon }) => (
          <li
            className={cn(styles.role, animated && motion.role)}
            key={name}
            onPointerMove={animated ? tilt : undefined}
            onPointerLeave={animated ? reset : undefined}
          >
            <Icon className={styles.roleIcon} strokeWidth={1.5} aria-hidden="true" />
            <strong>{name}</strong>
            <span>{description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
