'use client';
import { commonStrings } from '@/constants/strings/common';
import { landingStrings } from '@/constants/strings/landing';

import { landingClassName } from './landingStyles';

import { useState } from 'react';
import { Database, RadioTower, Settings } from 'lucide-react';

const roles = [
  {
    name: commonStrings.traffic,
    icon: RadioTower,
    title: landingStrings.readTheSurge,
    description: landingStrings.understandThePressureBringYourPrivate,
  },
  {
    name: commonStrings.data,
    icon: Database,
    title: landingStrings.protectEveryPass,
    description: landingStrings.followTheCorrectnessRisksHelpYour,
  },
  {
    name: commonStrings.operations,
    icon: Settings,
    title: landingStrings.ownTheTradeOffs,
    description: landingStrings.weighReliabilityAndCostBringYour,
  },
] as const;

export function RoleExplorer() {
  const [selected, setSelected] = useState(0);
  const role = roles[selected] ?? roles[0];
  return (
    <div
      className={landingClassName('hm-role-explorer')}
      aria-label={landingStrings.exploreEngineeringRoles}
    >
      <div
        className={landingClassName('hm-role-controls')}
        aria-label={landingStrings.yourSquadsPerspectives}
      >
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
      <p className={landingClassName('hm-caption')}>{landingStrings.exploreEachRoleInAMatch}</p>
    </div>
  );
}
