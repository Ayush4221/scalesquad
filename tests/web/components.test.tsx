import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { BriefPanel } from '../../src/features/brief/BriefPanel';
import { RepairPanel } from '../../src/features/repair/RepairPanel';
import { ResultsPanel } from '../../src/features/results/ResultsPanel';
import { ChatPanel } from '../../src/features/chat/ChatPanel';
import { cn } from '@/lib/utils';
import { allowedSignIn, publicSession } from '@/auth/callbacks';
import { fixture } from '../server/fakes';
afterEach(cleanup);
describe('private briefs and repair controls', () => {
  it('renders own card only and acknowledges through explicit action', async () => {
    const f = fixture(),
      id = await f.briefing(),
      cards = await f.evidence.get('a', id),
      ack = vi.fn();
    render(<BriefPanel cards={cards} acknowledged={false} busy={false} onAcknowledge={ack} />);
    expect(screen.getByText('◇ Private · only you')).toBeVisible();
    fireEvent.click(screen.getByRole('button'));
    expect(ack).toHaveBeenCalledOnce();
  });
  it('non-holder controls disabled and version visible', async () => {
    const f = fixture(),
      id = await f.repair(),
      view = await f.match.getPublicView('b', id);
    render(
      <RepairPanel
        view={view}
        userId="b"
        busy={false}
        onChange={vi.fn()}
        onPass={vi.fn()}
        onReclaim={vi.fn()}
      />,
    );
    expect(screen.getByText('v0')).toBeVisible();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByLabelText('App capacity')).toBeDisabled();
  });
  it('holder can edit atomically; mutation uses confirmed values', async () => {
    const f = fixture(),
      id = await f.repair(),
      view = await f.match.getPublicView('a', id),
      change = vi.fn();
    render(
      <RepairPanel
        view={view}
        userId="a"
        busy={false}
        onChange={change}
        onPass={vi.fn()}
        onReclaim={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('switch'));
    expect(change).toHaveBeenCalledWith({ atomicCheckin: true });
  });
  it('chat displays degraded state without trying a provider', () => {
    render(<ChatPanel matchId="m" available={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('Chat unavailable');
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
describe('hard-gate result presentation and auth callbacks', () => {
  it('a better latency metric with duplicates still shows FAILED', async () => {
    const f = fixture(),
      id = await f.repair();
    await f.run.start('a', id, 1);
    const runs = await f.run.get('a', id);
    const second = runs[1]!.result;
    render(
      <ResultsPanel
        runs={[{ runNumber: 3, result: { ...second, p95LatencyMs: 1 } }]}
        comparison={{
          status: 'FAILED',
          metrics: [{ metric: 'p95LatencyMs', before: 100, after: 1 }],
          gatesChanged: [],
          tradeoffs: ['Latency improved; correctness still fails.'],
        }}
      />,
    );
    expect(screen.getAllByText('FAILED').length).toBeGreaterThan(0);
    expect(screen.getByText('Latency improved; correctness still fails.')).toBeVisible();
    expect(screen.getByText('Same incident. A different design.')).toBeVisible();
  });
  it('verified identity only and session excludes extra fields', () => {
    expect(allowedSignIn('google', 'a@example.invalid', { email_verified: true })).toBe(true);
    expect(allowedSignIn('github', 'a@example.invalid', { email_verified: true })).toBe(true);
    for (const provider of ['google', 'github', 'other', undefined])
      expect(allowedSignIn(provider, 'a@example.invalid', {})).toBe(false);
    expect(allowedSignIn('google', null, {})).toBe(false);
    expect(allowedSignIn('google', 'a', null)).toBe(false);
    expect(publicSession({ id: 'a' }, 'expires')).toEqual({
      user: { id: 'a', name: 'Player', verified: false },
      expires: 'expires',
    });
    expect(cn('p-2', false && 'hidden', 'p-4')).toContain('p-4');
  });
});
