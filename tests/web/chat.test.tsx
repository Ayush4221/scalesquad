import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ChatPanel } from '../../src/features/chat/ChatPanel';
import type { ChatMessage } from '../../src/lib/nexconn/client';

const chat = vi.hoisted(() => ({
  receive: null as ((messages: ChatMessage[]) => void) | null,
  close: vi.fn(async () => {}),
}));
vi.mock('../../src/lib/api/client', () => ({
  api: async () => ({ token: 'test-token', appKey: 'test-key', groupRef: 'room', region: 'SG' }),
}));
vi.mock('../../src/lib/nexconn/client', () => ({
  NexconnClient: class {
    async connect(_access: unknown, receive: (messages: ChatMessage[]) => void) {
      chat.receive = receive;
    }
    close = chat.close;
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('chat availability changes', () => {
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
