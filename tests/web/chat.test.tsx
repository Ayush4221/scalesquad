import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { contentHash } from '@scalesquad/shared';
import { ChatPanel } from '../../src/features/chat/ChatPanel';
import type { ChatConnectionState, ChatMessage } from '../../src/lib/nexconn/client';
import { deferred } from '../helpers/deferred';

const chat = vi.hoisted(() => ({
  receive: null as ((messages: ChatMessage[]) => void) | null,
  status: null as ((state: ChatConnectionState) => void) | null,
  close: vi.fn(async () => {}),
  send: vi.fn(async (_text: string) => {}),
  connect: vi.fn(async () => {}),
}));
vi.mock('../../src/lib/api/client', () => ({
  api: async () => ({ token: 'test-token', appKey: 'test-key', groupRef: 'room', region: 'SG' }),
}));
vi.mock('../../src/lib/nexconn/client', () => ({
  NexconnClient: class {
    async connect(
      _access: unknown,
      receive: (messages: ChatMessage[]) => void,
      status?: (state: ChatConnectionState) => void,
    ) {
      chat.receive = receive;
      chat.status = status ?? null;
      await chat.connect();
    }
    close = chat.close;
    send = chat.send;
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('chat availability changes', () => {
  it('disables sends while the SDK reconnects, recovers, and ignores old-room status', async () => {
    const view = render(<ChatPanel matchId="old" available />);
    await screen.findByText('Connected');
    const oldStatus = chat.status!;
    fireEvent.change(screen.getByRole('textbox', { name: 'Message your squad' }), {
      target: { value: 'Keep my draft' },
    });
    act(() => oldStatus('connecting'));
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    act(() => oldStatus('connected'));
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
    act(() => oldStatus('unavailable'));
    expect(screen.getByRole('button', { name: 'Reconnect chat' })).toBeInTheDocument();
    view.rerender(<ChatPanel matchId="new" available />);
    await screen.findByText('Connected');
    act(() => oldStatus('unavailable'));
    expect(screen.queryByRole('button', { name: 'Reconnect chat' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Message your squad' })).toHaveValue('');
  });
  it('does not clear a draft edited away and back while an older send is pending', async () => {
    const pending = deferred<void>();
    chat.send.mockReturnValueOnce(pending.promise);
    render(
      <ChatPanel
        matchId="room"
        available
        cards={[
          {
            id: 'clue',
            role: 'OPS',
            phase: 'BRIEFING',
            private: true,
            facts: [{ id: 'fact', text: 'same text' }],
          },
        ]}
      />,
    );
    await screen.findByText('Connected');
    const input = screen.getByRole('textbox', { name: 'Message your squad' });
    fireEvent.change(input, { target: { value: 'same text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose a clue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to draft' }));
    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(input).toHaveValue('same text');
  });
  const members = [
    { userId: 'a', name: 'Ayush', role: 'OPS' as const },
    { userId: 'b', name: 'Maya', role: 'TRAFFIC' as const },
    { userId: 'c', name: 'Jordan', role: 'DATA' as const },
  ];
  it('shows exactly three seats and an unavailable beta voice channel', () => {
    render(<ChatPanel matchId="room" available={false} members={members} userId="a" />);
    expect(screen.getByRole('list', { name: 'Squad members' }).children).toHaveLength(3);
    expect(screen.getByText('3 / 3 players')).toBeVisible();
    expect(screen.getByText('BETA')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Join voice' })).toBeDisabled();
  });
  it('keeps clues private until a player deliberately drafts and sends one', async () => {
    render(
      <ChatPanel
        matchId="room"
        available
        members={members}
        userId="a"
        cards={[
          {
            id: 'own-clue',
            role: 'OPS',
            phase: 'BRIEFING',
            private: true,
            facts: [{ id: 'budget', text: 'Private budget clue' }],
          },
        ]}
      />,
    );
    await screen.findByText('Connected');
    expect(screen.queryByText('Private budget clue')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'My clues' }));
    expect(screen.getByText('Private budget clue')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Add to draft' }));
    expect(screen.getByRole('textbox', { name: 'Message your squad' })).toHaveValue(
      'Private budget clue',
    );
    expect(chat.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await act(async () => {});
    expect(chat.send).toHaveBeenCalledWith('Private budget clue');
    expect(screen.getByRole('textbox', { name: 'Message your squad' })).toHaveValue('');
  });
  it('adds mentions, quotes messages and allows cancelling a reply', async () => {
    render(<ChatPanel matchId="room" available members={members} userId="a" />);
    await screen.findByText('Connected');
    fireEvent.click(screen.getByRole('button', { name: 'Mention Maya' }));
    const input = screen.getByRole('textbox', { name: 'Message your squad' });
    expect(input).toHaveValue('@Maya ');
    act(() =>
      chat.receive?.([
        {
          id: 'm',
          sender: `u${contentHash('b').slice(0, 48)}`,
          text: 'Check the traffic peak.',
          sentAt: 1,
        },
      ]),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reply to Maya' }));
    expect(input).toHaveValue('> Maya: Check the traffic peak.\n\n');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel reply' }));
    expect(input).toHaveValue('');
    expect(chat.send).not.toHaveBeenCalled();
  });
  it('retains failed drafts for retry and prevents simultaneous duplicate sends', async () => {
    render(<ChatPanel matchId="room" available />);
    await screen.findByText('Connected');
    const input = screen.getByRole('textbox', { name: 'Message your squad' });
    fireEvent.change(input, { target: { value: 'Keep this draft' } });
    chat.send.mockRejectedValueOnce(new Error('upstream failure'));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByRole('alert');
    expect(input).toHaveValue('Keep this draft');
    let finish!: () => void;
    chat.send.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const form = input.closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(chat.send).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Sending' })).toBeDisabled();
    await act(async () => finish());
    expect(input).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('allows a failed connection to reconnect', async () => {
    chat.connect.mockRejectedValueOnce(new Error('offline'));
    render(<ChatPanel matchId="room" available />);
    await screen.findByText('Chat unavailable. You can still play.');
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect chat' }));
    await screen.findByText('Connected');
    expect(chat.connect).toHaveBeenCalledTimes(2);
  });
  it('clears old messages and disables the composer when the channel becomes unavailable', async () => {
    const view = render(<ChatPanel matchId="room" available />);
    await screen.findByText('Connected');
    act(() => chat.receive?.([{ id: 'message', sender: 'a', text: 'Room message', sentAt: 1 }]));
    expect(screen.getByText('Room message')).toBeInTheDocument();
    view.rerender(<ChatPanel matchId="room" available={false} />);
    expect(screen.queryByText('Room message')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message your squad' })).toBeDisabled();
    expect(chat.close).toHaveBeenCalledOnce();
  });
});
