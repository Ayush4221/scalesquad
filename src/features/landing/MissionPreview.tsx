'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  MessageSquare,
  Pause,
  Play,
  RadioTower,
  RotateCcw,
  ScanLine,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import styles from './landing.module.css';

const scenes = [
  {
    label: 'The incident',
    title: 'One pass. One admission.',
    detail: 'A campus event. A rush of scans. A system that needs your squad.',
    icon: ScanLine,
  },
  {
    label: 'Spot the pressure',
    title: 'A surge hits the gates.',
    detail: 'Traffic rises. The system is under pressure. Start by understanding what is failing.',
    icon: RadioTower,
  },
  {
    label: 'Connect your clues',
    title: 'Nobody has the whole picture.',
    detail:
      'Traffic, Data and Operations each have private evidence. The breakthrough comes from sharing it.',
    icon: MessageSquare,
  },
  {
    label: 'Make the call',
    title: 'Build the repair together.',
    detail:
      'Discuss the trade-offs, adjust your design and pass edit control when another perspective helps.',
    icon: Wrench,
  },
  {
    label: 'Prove the repair',
    title: 'Let the next run decide.',
    detail:
      'Test the same incident. Compare correctness, throughput and cost to see what actually changed.',
    icon: Activity,
  },
] as const;

const SCENE_DURATION = 2400;

export function MissionPreview() {
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const current = scenes[scene] ?? scenes[0];
  const Icon = current.icon;
  const finished = scene === scenes.length - 1;

  useEffect(() => {
    if (reducedMotion) {
      if (playing) setPlaying(false);
      return;
    }
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (scene === scenes.length - 1) setPlaying(false);
      else setScene(scene + 1);
    }, SCENE_DURATION);
    return () => window.clearTimeout(timer);
  }, [scene, playing, reducedMotion]);

  function toggle() {
    if (reducedMotion) {
      setPlaying(false);
      setScene(finished ? 0 : scene + 1);
      return;
    }
    if (playing) {
      setPlaying(false);
      return;
    }
    if (finished) setScene(0);
    setPlaying(true);
  }

  return (
    <aside className={styles.missionCard} aria-label="CampusPass mission preview">
      <div className={styles.missionTop}>
        <span className={styles.mono}>INCIDENT BRIEF / 01</span>
        <span className={styles.missionBadge}>
          <span /> CampusPass
        </span>
      </div>
      <div className={styles.scanField} data-playing={playing} aria-hidden="true">
        <div className={styles.scanGrid} />
        <span className={styles.scanBeam} />
        <span className={styles.scanCorner} />
        <span className={styles.scanCornerEnd} />
        <div className={styles.sceneMark} key={scene}>
          <Icon strokeWidth={1.35} />
        </div>
        <span className={styles.scanLabel}>{current.label}</span>
      </div>
      <div className={styles.sceneCopy} aria-live="polite" aria-atomic="true">
        <div className={styles.sceneContent} key={scene}>
          <h2>{current.title}</h2>
          <p>{current.detail}</p>
        </div>
      </div>
      <div
        className={styles.sceneProgress}
        aria-label={`Preview scene ${scene + 1} of ${scenes.length}`}
      >
        {scenes.map((item, index) => (
          <span key={item.label} data-current={index === scene} data-complete={index < scene} />
        ))}
      </div>
      <div className={styles.missionBottom}>
        <span className={styles.previewLabel}>A glimpse of the game</span>
        <Button type="button" variant="ghost" className={styles.previewButton} onClick={toggle}>
          {playing ? (
            <Pause aria-hidden="true" />
          ) : finished ? (
            <RotateCcw aria-hidden="true" />
          ) : (
            <Play aria-hidden="true" />
          )}
          {reducedMotion
            ? finished
              ? 'Restart preview'
              : 'Next scene'
            : playing
              ? 'Pause preview'
              : finished
                ? 'Replay preview'
                : scene > 0
                  ? 'Continue preview'
                  : 'Watch the preview'}
        </Button>
      </div>
    </aside>
  );
}
