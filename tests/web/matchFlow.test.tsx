import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServerEvent } from '../../src/shared';
import { fixture } from '../server/fakes';
import { useMatch } from '../../src/features/lobby/useMatch';
import { RunAction } from '../../src/features/lobby/RunAction';
import { LobbyPanel } from '../../src/features/lobby/LobbyPanel';
import { RepairPanel } from '../../src/features/repair/RepairPanel';

const mock = vi.hoisted(() => ({
  api: vi.fn(),
  receive: null as ((event: ServerEvent) => void) | null,
  push: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({ api: mock.api }));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => false }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mock.push }) }));
vi.mock('@/lib/ws/client', () => ({
  WsClient: class {
    constructor(_url: string, receive: (event: ServerEvent) => void) {
      mock.receive = receive;
    }
    connect() {}
    close() {}
    send() {}
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('match feedback and controls', () => {
  it('preserves the selected mission and clears stale errors only on a newer snapshot', async () => {
    const f = fixture(),
      view = await f.match.createMatch('a', 'flash-crowd');
    mock.api.mockResolvedValue(view);
    const { result } = renderHook(() => useMatch(view.id));
    await waitFor(() => expect(result.current.view?.id).toBe(view.id));
    expect(result.current.view?.scenario.title).toBe(view.scenario.title);
    act(() => result.current.setError('An old error'));
    act(() => mock.receive!({ v: 1, id: 'same', type: 'match.snapshot', payload: view }));
    expect(result.current.error).toBe('An old error');
    act(() =>
      mock.receive!({
        v: 1,
        id: 'new',
        type: 'match.snapshot',
        payload: { ...view, revision: view.revision + 1 },
      }),
    );
    expect(result.current.error).toBe('');
  });
  it('does not label a configuration save as a running simulation', async () => {
    const f = fixture(),
      id = await f.repair(),
      view = await f.match.getPublicView('a', id);
    render(<RunAction view={view} userId="a" pendingAction="/config" action={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Run baseline \+ incident/ })).toBeDisabled();
    expect(screen.queryByText('Running…')).not.toBeInTheDocument();
  });
  it('shows not-ready membership and announces a successful code copy', async () => {
    const f = fixture(),
      view = await f.match.createMatch('a');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    render(
      <LobbyPanel
        view={view}
        userId="a"
        busy={false}
        pendingAction={null}
        action={vi.fn()}
        onError={vi.fn()}
      />,
    );
    expect(screen.getByText('Not ready', { exact: true })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Code copied'));
  });
  it('limits repair options to the public scenario choices and links labels and help', async () => {
    const f = fixture(),
      id = await f.repair(),
      view = await f.match.getPublicView('a', id);
    view.scenario.choices.capacity = ['LOW'];
    render(
      <RepairPanel
        view={view}
        userId="a"
        busy={false}
        onChange={vi.fn()}
        onPass={vi.fn()}
        onReclaim={vi.fn()}
      />,
    );
    const input = screen.getByLabelText('App capacity');
    expect(input.id).not.toContain(' ');
    expect(input).toHaveAttribute('aria-describedby');
    fireEvent.click(input);
    expect(await screen.findByRole('button', { name: 'Low' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'High' })).not.toBeInTheDocument();
  });
});
