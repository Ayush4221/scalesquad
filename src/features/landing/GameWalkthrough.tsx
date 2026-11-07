'use client';
import { landingClassName } from './landingStyles';

import { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const scenes = [
  {
    label: 'Clues',
    title: 'Nobody has the whole picture.',
    copy: 'Each engineer gets a private brief. Connect your evidence through the squad’s conversation.',
  },
  {
    label: 'Repair',
    title: 'Make the call together.',
    copy: 'Discuss the trade-offs, adjust your design, and pass edit control when another perspective helps.',
  },
  {
    label: 'Compare',
    title: 'Same incident. New evidence.',
    copy: 'Test the repair under the same conditions. Compare correctness, throughput and cost to understand what changed.',
  },
] as const;
const SCENE_DURATION = 4200;

export function GameWalkthrough() {
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const current = scenes[scene] ?? scenes[0];
  const finished = scene === scenes.length - 1;
  useEffect(() => {
    if (reduced) {
      setPlaying(false);
      return;
    }
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (finished) setPlaying(false);
      else setScene((value) => value + 1);
    }, SCENE_DURATION);
    return () => window.clearTimeout(timer);
  }, [scene, playing, reduced, finished]);
  useEffect(() => {
    const pause = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);
  function select(index: number) {
    setPlaying(false);
    setScene(index);
  }
  function toggle() {
    if (reduced) {
      select(finished ? 0 : scene + 1);
      return;
    }
    if (finished && !playing) setScene(0);
    setPlaying((value) => !value);
  }
  const label = reduced
    ? finished
      ? 'Restart walkthrough'
      : 'Next scene'
    : playing
      ? 'Pause walkthrough'
      : finished
        ? 'Replay walkthrough'
        : 'Play the walkthrough';
  return (
    <>
      <div className={landingClassName('hm-round-controls')} aria-label="Explore the game loop">
        {scenes.map((item, index) => (
          <button
            key={item.label}
            type="button"
            className={landingClassName('hm-scene-button')}
            aria-pressed={scene === index}
            onClick={() => select(index)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div aria-live="polite" aria-atomic="true">
        <div className={landingClassName('hm-step')} key={scene}>
          <span aria-hidden="true">0{scene + 1}</span>
          <div>
            <h3>{current.title}</h3>
            <p>{current.copy}</p>
          </div>
        </div>
      </div>
      <div className={landingClassName('hm-play-row')}>
        <button type="button" className={landingClassName('hm-link')} onClick={toggle}>
          {playing ? (
            <Pause className="size-5 shrink-0" aria-hidden="true" />
          ) : finished ? (
            <RotateCcw aria-hidden="true" />
          ) : (
            <Play aria-hidden="true" />
          )}
          <span>{label}</span>
        </button>
        <span>
          Scene {scene + 1} of {scenes.length}
        </span>
      </div>
    </>
  );
}
