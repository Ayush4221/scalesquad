import { layoutClassName } from '@/styles/layout';
import type { PublicMatchView } from '@scalesquad/shared';
import { Button } from '@/components/ui/button';
import type { useMatch } from './useMatch';
export function RunAction({
  view,
  userId,
  pendingAction,
  action,
}: {
  view: PublicMatchView;
  userId: string;
  pendingAction: string | null;
  action: ReturnType<typeof useMatch>['action'];
}) {
  const baseline = view.phase === 'REPAIR_1';
  const running = pendingAction === '/runs' || view.simulationLocked;
  const canRun =
    (view.hostUserId === userId || view.lock?.holderUserId === userId) &&
    pendingAction === null &&
    !view.simulationLocked;
  return (
    <div className="run-action flex items-center justify-between gap-5 rounded-xl border border-[var(--success-border)] bg-[var(--success-background)] p-[22px] max-[650px]:flex-col max-[650px]:items-start">
      <div>
        <strong>{baseline ? 'Establish the baseline' : 'Test your repaired design'}</strong>
        <p className={layoutClassName('muted text-sm')}>
          {baseline
            ? 'Runs 1 and 2 use the original preset. Your proposal is saved for Run 3.'
            : 'The same incident and traffic from Run 2. Only your repair changes.'}
        </p>
      </div>
      <Button
        disabled={!canRun}
        aria-busy={running}
        onClick={() => void action('/runs', { runNumber: baseline ? 1 : 3 })}
      >
        {running ? 'Running…' : baseline ? 'Run baseline + incident →' : 'Run repair →'}
      </Button>
    </div>
  );
}
