'use client';
import { landingClassName } from './landingStyles';

import { useState } from 'react';
import { Database, RadioTower, Settings } from 'lucide-react';

const roles = [
  {
    name: 'Traffic',
    icon: RadioTower,
    title: 'Read the\nsurge.',
    description: 'Understand the pressure. Bring your private evidence to the squad.',
  },
  {
    name: 'Data',
    icon: Database,
    title: 'Protect\nevery pass.',
    description: 'Follow the correctness risks. Help your squad protect single-use admissions.',
  },
  {
    name: 'Operations',
    icon: Settings,
    title: 'Own the\ntrade-offs.',
    description: 'Weigh reliability and cost. Bring your perspective to the repair.',
  },
] as const;

export function RoleExplorer() {
  const [selected, setSelected] = useState(0);
  const role = roles[selected] ?? roles[0];
  return (
    <div className={landingClassName('hm-role-explorer')} aria-label="Explore engineering roles">
      <div className={landingClassName('hm-role-controls')} aria-label="Your squad’s perspectives">
        {roles.map(({ name, icon: Icon }, index) => (
          <button
            key={name}
            type="button"
            className={landingClassName('hm-role-button')}
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
          >
            <Icon className="size-6 shrink-0" aria-hidden="true" />
            {name}
            <span className={landingClassName('hm-role-index')} aria-hidden="true">
              0{index + 1}
            </span>
          </button>
        ))}
      </div>
      <div aria-live="polite" aria-atomic="true">
        <div className={landingClassName('hm-role-copy')} key={selected}>
          <h2>{role.title}</h2>
          <p>{role.description}</p>
        </div>
      </div>
      <p className={landingClassName('hm-caption')}>
        Explore each role. In a match, roles reveal when play begins.
      </p>
    </div>
  );
}
