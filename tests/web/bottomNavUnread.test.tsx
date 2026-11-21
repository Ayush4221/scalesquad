import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BottomNav } from '@/components/shared/BottomNav';

describe('chat navigation with unread messages', () => {
  it('keeps Chat discoverable by name and reports its unread count separately', () => {
    const select = vi.fn();
    const { rerender } = render(
      <BottomNav phase="BRIEFING" active="Brief" unread={1} onSelect={select} />,
    );
    const chat = screen.getByRole('button', { name: 'Chat' });
    expect(chat).toHaveAccessibleDescription('1 unread message');
    fireEvent.click(chat);
    expect(select).toHaveBeenCalledWith('Chat');
    rerender(<BottomNav phase="BRIEFING" active="Chat" unread={0} onSelect={select} />);
    expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Chat' })).not.toHaveAttribute('aria-description');
  });
});
