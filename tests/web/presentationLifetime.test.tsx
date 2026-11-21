import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InviteCode } from '../../src/features/lobby/InviteCode';
import { ResponsiveSelect } from '../../src/components/shared/ResponsiveSelect';
import { useInstallPrompt } from '../../src/pwa/useInstallPrompt';
import { deferred } from '../helpers/deferred';

vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => false }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});
describe('presentation lifetimes', () => {
  it('ignores old copy completion when the invite changes and expires new feedback', async () => {
    vi.useFakeTimers();
    const old = deferred<void>(),
      writeText = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(undefined),
      onError = vi.fn();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const view = render(<InviteCode code="ABCDEFGH" onError={onError} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    view.rerender(<InviteCode code="JKLMNPQR" onError={onError} />);
    await act(async () => {
      old.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent('');
    expect(onError).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    await act(async () => {});
    expect(screen.getByRole('status')).toHaveTextContent('Code copied');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByRole('status')).toHaveTextContent('');
  });
  it('closes an open phone selector if editing becomes disabled', () => {
    const onChange = vi.fn(),
      props = {
        label: 'Capacity',
        value: 'LOW',
        choices: [{ value: 'HIGH', label: 'High' }],
        onChange,
      };
    const view = render(<ResponsiveSelect {...props} disabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Capacity' }));
    expect(screen.getByRole('button', { name: 'High' })).toBeVisible();
    view.rerender(<ResponsiveSelect {...props} disabled />);
    expect(screen.queryByRole('button', { name: 'High' })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
  it('consumes a rejected install prompt once and accepts a later browser event', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
    const hook = renderHook(() => useInstallPrompt());
    const prompt = vi.fn().mockRejectedValueOnce(new Error('cancelled'));
    act(() => {
      window.dispatchEvent(
        Object.assign(new Event('beforeinstallprompt'), {
          prompt,
          userChoice: Promise.resolve({ outcome: 'dismissed' }),
        }),
      );
    });
    await act(async () => {
      await Promise.all([hook.result.current.promptInstall(), hook.result.current.promptInstall()]);
    });
    expect(prompt).toHaveBeenCalledOnce();
    prompt.mockResolvedValueOnce(undefined);
    act(() => {
      window.dispatchEvent(
        Object.assign(new Event('beforeinstallprompt'), {
          prompt,
          userChoice: Promise.resolve({ outcome: 'accepted' }),
        }),
      );
    });
    await act(async () => {
      await hook.result.current.promptInstall();
    });
    expect(prompt).toHaveBeenCalledTimes(2);
  });
});
