'use client';
import { lobbyStrings } from '@/constants/strings/lobby';

import type { ScenarioId } from '@scalesquad/shared';
import { scenarioCatalog } from '@/constants/scenarios';
import styles from './dashboard.module.css';
export function ScenarioPicker({
  value,
  onChange,
  disabled,
}: {
  value: ScenarioId;
  onChange: (id: ScenarioId) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className={styles.scenarioPicker} disabled={disabled}>
      <legend>{lobbyStrings.chooseYourMission}</legend>
      <p className={styles.hint}>{lobbyStrings.hostingPickAChallengeJoiningYour}</p>
      <div className={styles.scenarioOptions}>
        {scenarioCatalog.map((mission) => (
          <label key={mission.id} className={styles.scenarioOption}>
            <input
              type="radio"
              name="scenario"
              value={mission.id}
              checked={value === mission.id}
              onChange={() => onChange(mission.id)}
            />
            <span>
              <strong>{mission.title}</strong>
              <small>{mission.focus}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
