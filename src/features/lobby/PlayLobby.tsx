'use client';
import { commonStrings } from '@/constants/strings/common';
import { lobbyStrings } from '@/constants/strings/lobby';

import { layoutClassName } from '@/styles/layout';

import { JOIN_CODE_LENGTH } from '@/constants/joinCode';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Database, LoaderCircle, ShieldCheck, Users } from 'lucide-react';
import { JoinMatchSchema, PublicMatchView } from '@scalesquad/shared';
import type { ScenarioId } from '@scalesquad/shared';
import { scenarioCatalog } from '@/constants/scenarios';
import { ScenarioPicker } from './ScenarioPicker';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHydrated } from '@/hooks/useHydrated';
import styles from './dashboard.module.css';

type Action = 'create' | 'join';

export function PlayLobby({ name }: { name: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const pending = useRef(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [scenarioId, setScenarioId] = useState<ScenarioId>('campuspass');
  const mission = scenarioCatalog.find((scenario) => scenario.id === scenarioId)!;
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<{ action: Action; message: string } | null>(null);

  async function enter(action: Action) {
    if (pending.current || !hydrated) return;
    const join = JoinMatchSchema.safeParse({ code });
    if (action === 'join' && !join.success) {
      setError({
        action,
        message: lobbyStrings.enterThe8CharacterCodeFrom,
      });
      codeInput.current?.focus();
      return;
    }
    pending.current = true;
    setBusy(action);
    setError(null);
    try {
      const view = PublicMatchView.parse(
        await api(
          action === 'join' ? '/matches/join' : '/matches',
          action === 'join' && join.success ? join.data : { scenarioId },
        ),
      );
      router.push(`/match/${view.id}`);
    } catch (cause) {
      setError({
        action,
        message: cause instanceof Error ? cause.message : lobbyStrings.couldNotEnterSquadTryAgain,
      });
      pending.current = false;
      setBusy(null);
    }
  }

  return (
    <div className={styles.content}>
      <section className={styles.heading} aria-labelledby="dashboard-title">
        <h1 id="dashboard-title">{lobbyStrings.yourSquadStartsHere}</h1>
        <p>
          {lobbyStrings.welcome}
          {name}
          {lobbyStrings.bringTwoTeammatesSolveOneIncident}
        </p>
      </section>
      <ScenarioPicker
        value={scenarioId}
        onChange={setScenarioId}
        disabled={!hydrated || busy !== null}
      />
      <div className={styles.actions}>
        <section className={styles.host} aria-labelledby="host-title">
          <Users className={styles.hostIcon} aria-hidden="true" />
          <h2 id="host-title">{lobbyStrings.openAControlRoom}</h2>
          <p>
            {lobbyStrings.hostPrefix}
            {mission.title}
            {lobbyStrings.thenShareYourInviteCode}
          </p>
          <Button
            className={styles.actionButton}
            disabled={!hydrated || busy !== null}
            onClick={() => void enter('create')}
            aria-busy={busy === 'create'}
          >
            {busy === 'create' && <LoaderCircle className={styles.spinner} aria-hidden="true" />}
            {busy === 'create' ? lobbyStrings.creatingSquad : lobbyStrings.createSquad}
          </Button>
          {error?.action === 'create' && (
            <p className={layoutClassName(`error ${styles.error}`)} role="alert">
              {error.message}
            </p>
          )}
        </section>
        <section className={styles.join} aria-labelledby="join-title">
          <h2 id="join-title">{lobbyStrings.gotAnInvite}</h2>
          <p>{lobbyStrings.yourHostHasTheCodeYour}</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void enter('join');
            }}
            noValidate
          >
            <label htmlFor="squad-code">{lobbyStrings.joinCode}</label>
            <div className={styles.joinControls}>
              <Input
                ref={codeInput}
                id="squad-code"
                disabled={!hydrated || busy !== null}
                placeholder={lobbyStrings.text8CharacterCode}
                maxLength={JOIN_CODE_LENGTH}
                value={code}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-invalid={error?.action === 'join'}
                aria-describedby={error?.action === 'join' ? 'join-help join-error' : 'join-help'}
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase());
                  if (error?.action === 'join') setError(null);
                }}
              />
              <Button
                className={styles.actionButton}
                variant="secondary"
                type="submit"
                disabled={!hydrated || busy !== null}
                aria-busy={busy === 'join'}
              >
                {busy === 'join' && <LoaderCircle className={styles.spinner} aria-hidden="true" />}
                {busy === 'join' ? lobbyStrings.joining : lobbyStrings.join}
              </Button>
            </div>
            <p id="join-help" className={styles.hint}>
              {lobbyStrings.eightLettersAndNumbersNoSpaces}
            </p>
            {error?.action === 'join' && (
              <p id="join-error" className={layoutClassName(`error ${styles.error}`)} role="alert">
                {error.message}
              </p>
            )}
          </form>
        </section>
      </div>
      <p className="sr-only" role="status">
        {busy === 'create'
          ? lobbyStrings.creatingYourSquadPleaseWait
          : busy === 'join'
            ? lobbyStrings.joiningYourSquadPleaseWait
            : ''}
      </p>
      <section className={styles.mission} aria-labelledby="mission-title">
        <div className={styles.missionIntro}>
          <h2 id="mission-title">{mission.title}</h2>
          <p>{lobbyStrings.onePassOneAdmission}</p>
          <span>{mission.description}</span>
          {mission.source && (
            <p className={styles.source}>
              <a href={mission.source.url} target="_blank" rel="noreferrer">
                {mission.source.label}
              </a>
              <small>{lobbyStrings.inspiredByTheFailurePatternFictional}</small>
            </p>
          )}
        </div>
        <ul className={styles.roles}>
          <li>
            <Activity aria-hidden="true" />
            <div>
              <h3>{commonStrings.traffic}</h3>
              <p>{lobbyStrings.handleTheSurge}</p>
            </div>
          </li>
          <li>
            <Database aria-hidden="true" />
            <div>
              <h3>{commonStrings.data}</h3>
              <p>{commonStrings.protectSingleUsePasses}</p>
            </div>
          </li>
          <li>
            <ShieldCheck aria-hidden="true" />
            <div>
              <h3>{commonStrings.operations}</h3>
              <p>{lobbyStrings.keepTheSystemReliable}</p>
            </div>
          </li>
        </ul>
      </section>
    </div>
  );
}
