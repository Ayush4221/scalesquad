import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { LandingPage } from '../../src/features/landing/LandingPage';
import { MissionPreview } from '../../src/features/landing/MissionPreview';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useLinkStatus: () => ({ pending: false }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('public Incident Brief home', () => {
  it('explains the game and points guests to real signup and sign-in pages', () => {
    render(<LandingPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      'System under load. Squad up.',
    );
    expect(screen.getByText(/ScaleSquad is a three-player system design game/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Create your squad' })).toHaveAttribute(
      'href',
      '/register',
    );
    expect(screen.getAllByRole('link', { name: 'Sign in' })).toHaveLength(2);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Traffic' })).toBeVisible();
  });
  it('can pause, finish and replay the mission preview without leaving timers behind', async () => {
    vi.useFakeTimers();
    const view = render(<MissionPreview />);
    fireEvent.click(screen.getByRole('button', { name: 'Watch the preview' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2400);
    });
    expect(screen.getByRole('heading', { name: 'A surge hits the gates.' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Pause preview' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7200);
    });
    expect(screen.getByRole('heading', { name: 'A surge hits the gates.' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Continue preview' }));
    for (let index = 0; index < 4; index++)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2400);
      });
    expect(screen.getByRole('heading', { name: 'Let the next run decide.' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Replay preview' }));
    expect(screen.getByRole('heading', { name: 'One pass. One admission.' })).toBeVisible();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('lets reduced-motion users advance scenes manually', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: () => true,
    }));
    render(<MissionPreview />);
    fireEvent.click(screen.getByRole('button', { name: 'Next scene' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50000);
    });
    expect(screen.getByRole('heading', { name: 'A surge hits the gates.' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Pause preview' })).not.toBeInTheDocument();
  });
  it('stops autoplay when the motion preference changes while watching', async () => {
    vi.useFakeTimers();
    const media = Object.assign(new EventTarget(), {
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    });
    vi.spyOn(window, 'matchMedia').mockReturnValue(media);
    render(<MissionPreview />);
    fireEvent.click(screen.getByRole('button', { name: 'Watch the preview' }));
    act(() => {
      media.matches = true;
      media.dispatchEvent(new Event('change'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(24000);
    });
    expect(screen.getByRole('heading', { name: 'One pass. One admission.' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next scene' }));
    expect(screen.getByRole('heading', { name: 'A surge hits the gates.' })).toBeVisible();
  });
});
