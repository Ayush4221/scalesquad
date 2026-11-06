import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { LandingPage } from '../../src/features/landing/LandingPage';
import { GameWalkthrough } from '../../src/features/landing/GameWalkthrough';

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

describe('Hallmark public home', () => {
  it('advances the walkthrough, pauses on a selected scene, and cleans up playback', async () => {
    vi.useFakeTimers();
    const view = render(<LandingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Play the walkthrough' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4200);
    });
    expect(screen.getByRole('heading', { name: 'Make the call together.' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
    });
    expect(screen.getByRole('heading', { name: 'Same incident. New evidence.' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Replay walkthrough' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Replay walkthrough' }));
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('explains the game and points guests to real signup and sign-in pages', () => {
    render(<LandingPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Think as a squad.');
    expect(screen.getByText(/A system design game for three engineers/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Build your squad' })).toHaveAttribute(
      'href',
      '/register',
    );
    expect(screen.getByRole('link', { name: /Sign in/ })).toHaveAttribute('href', '/signin');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Data' }));
    expect(screen.getByText(/Follow the correctness risks/)).toBeVisible();
  });
  it('can pause, finish and replay the mission preview without leaving timers behind', async () => {
    vi.useFakeTimers();
    const view = render(<GameWalkthrough />);
    fireEvent.click(screen.getByRole('button', { name: 'Play the walkthrough' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4200);
    });
    expect(screen.getByRole('heading', { name: 'Make the call together.' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Pause walkthrough' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7200);
    });
    expect(screen.getByRole('heading', { name: 'Make the call together.' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Play the walkthrough' }));
    for (let index = 0; index < 4; index++)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4200);
      });
    expect(screen.getByRole('heading', { name: 'Same incident. New evidence.' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Replay walkthrough' }));
    expect(screen.getByRole('heading', { name: 'Nobody has the whole picture.' })).toBeVisible();
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
    render(<GameWalkthrough />);
    fireEvent.click(screen.getByRole('button', { name: 'Next scene' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50000);
    });
    expect(screen.getByRole('heading', { name: 'Make the call together.' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Pause walkthrough' })).not.toBeInTheDocument();
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
    render(<GameWalkthrough />);
    fireEvent.click(screen.getByRole('button', { name: 'Play the walkthrough' }));
    act(() => {
      media.matches = true;
      media.dispatchEvent(new Event('change'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(24000);
    });
    expect(screen.getByRole('heading', { name: 'Nobody has the whole picture.' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next scene' }));
    expect(screen.getByRole('heading', { name: 'Make the call together.' })).toBeVisible();
  });
});
