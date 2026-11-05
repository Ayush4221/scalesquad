'use client';
import { useEffect, useState, type ReactNode } from 'react';
import type { MatchPhase } from '@scalesquad/shared';
export type MatchTab = 'Brief' | 'Squad' | 'Repair' | 'Results' | 'Chat';
export function BottomNav({
  phase,
  active,
  onSelect,
  unread = 0,
}: {
  phase: MatchPhase;
  active: MatchTab;
  onSelect: (tab: MatchTab) => void;
  unread?: number;
}) {
  return (
    <nav className="bottom-nav" aria-label="Match sections">
      {(['Brief', 'Squad', 'Repair', 'Results', 'Chat'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          aria-current={active === tab ? 'page' : undefined}
          disabled={
            (tab === 'Brief' && phase === 'LOBBY') ||
            (tab === 'Repair' && ['LOBBY', 'BRIEFING'].includes(phase)) ||
            (tab === 'Results' && ['LOBBY', 'BRIEFING', 'REPAIR_1'].includes(phase))
          }
          onClick={() => onSelect(tab)}
        >
          {tab}
          {tab === 'Chat' && unread > 0 ? ` (${unread})` : ''}
        </button>
      ))}
    </nav>
  );
}
export function TopStatusBar({
  phase,
  deadline,
  holder,
  connection,
}: {
  phase: MatchPhase;
  deadline: number | null;
  holder: string;
  connection: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="status-bar" role="status">
      <strong>{phase.replaceAll('_', ' ')}</strong>
      <span>
        {deadline && now !== null ? `${Math.max(0, Math.ceil((deadline - now) / 1000))}s` : ''}
      </span>
      <span>Editor: {holder}</span>
      <span data-connection={connection}>● {connection}</span>
    </div>
  );
}
export function SafeAreaView({ children }: { children: ReactNode }) {
  return <div className="safe-area-view">{children}</div>;
}
export function MetricCard({
  label,
  before,
  after,
}: {
  label: string;
  before: number;
  after: number;
}) {
  return (
    <article className="metric-card">
      <h3>{label}</h3>
      <p>
        {Number(before.toFixed(2)).toLocaleString()} →{' '}
        <strong>{Number(after.toFixed(2)).toLocaleString()}</strong>
      </p>
      <small>Change: {Number((after - before).toFixed(2)).toLocaleString()}</small>
    </article>
  );
}
