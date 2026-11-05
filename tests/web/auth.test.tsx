import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, createEvent, render, screen, fireEvent } from '@testing-library/react';
import { LoginForm } from '../../src/features/auth/LoginForm';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  history.replaceState(null, '', '/');
});

describe('password forms', () => {
  it('supports password managers, show/hide and generic sign-in errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 401 })),
    );
    render(<LoginForm />);
    const email = screen.getByLabelText('Email address');
    const password = screen.getByLabelText('Password', { exact: true });
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
    fireEvent.change(email, { target: { value: 'ada@example.invalid' } });
    fireEvent.change(password, { target: { value: 'long passphrase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);
    expect(screen.getByRole('button', { name: 'Signing in' })).toBeDisabled();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not sign in with those details',
    );
    expect(password).toHaveValue('long passphrase');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('validates fields without a request and focuses the first invalid field', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<LoginForm />);
    const form = screen.getByRole('button', { name: 'Sign in' }).closest('form')!;
    fireEvent.submit(form);
    expect(screen.getByLabelText('Email address')).toHaveFocus();
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute(
      'aria-describedby',
      'login-password-error',
    );
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'ada@example.invalid' },
    });
    fireEvent.submit(form);
    expect(screen.getByLabelText('Password', { exact: true })).toHaveFocus();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses the login schema, blocks duplicate submits and permits retry after failure', async () => {
    let finish!: (response: Response) => void;
    const fetch = vi.fn(
      (_url: RequestInfo | URL, _options?: RequestInit) =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetch);
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: '  ADA@example.invalid  ' },
    });
    // Login accepts existing credentials without applying the current signup policy.
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), {
      target: { value: 'x' },
    });
    const form = screen.getByRole('button', { name: 'Sign in' }).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![0]).toBe('/api/game/auth/login');
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({
      email: 'ada@example.invalid',
      password: 'x',
    });
    expect(screen.getByLabelText('Email address')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled();
    finish(new Response('{"error":{"message":"private server failure"}}', { status: 503 }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Check your email and password.');
    expect(screen.queryByText('private server failure')).not.toBeInTheDocument();
    fireEvent.submit(form);
    expect(fetch).toHaveBeenCalledTimes(2);
    finish(new Response('{}', { status: 401 }));
    await screen.findByRole('alert');
  });

  it('login offers signup without unavailable email recovery links', () => {
    render(<LoginForm />);
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'href',
      '/register',
    );
    expect(screen.queryByRole('link', { name: /forgot|verify/i })).not.toBeInTheDocument();
  });

  it('confirms real success, clears the password and keeps every control locked until navigation', async () => {
    vi.useFakeTimers();
    let finish!: (response: Response) => void;
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetch);
    const view = render(<LoginForm />);
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'player@example.invalid' },
    });
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), {
      target: { value: 'Existing password' },
    });
    const form = screen.getByRole('button', { name: 'Sign in' }).closest('form')!;
    fireEvent.submit(form);
    expect(screen.getByRole('button', { name: 'Signing in' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await act(async () => {
      finish(new Response('{}'));
    });
    expect(screen.getByRole('button', { name: 'Welcome back' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Welcome back' })).toHaveAttribute(
      'aria-busy',
      'false',
    );
    expect(screen.getByLabelText('Password', { exact: true })).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent('Signed in. Opening your control room.');
    fireEvent.submit(form);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not navigate after a pending form unmounts', async () => {
    vi.useFakeTimers();
    let finish!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const view = render(<LoginForm />);
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'player@example.invalid' },
    });
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), {
      target: { value: 'Existing password' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);
    view.unmount();
    await act(async () => {
      finish(new Response('{}'));
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports email format on blur and handles Caps Lock without changing password-manager fields', () => {
    render(<LoginForm />);
    const email = screen.getByLabelText('Email address');
    fireEvent.change(email, { target: { value: 'invalid' } });
    fireEvent.blur(email);
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
    fireEvent.change(email, { target: { value: 'player@example.invalid' } });
    fireEvent.blur(email);
    expect(email).toHaveAttribute('aria-invalid', 'false');
    const password = screen.getByLabelText('Password', { exact: true });
    const capsEvent = createEvent.keyUp(password, { key: 'A' });
    Object.defineProperty(capsEvent, 'getModifierState', {
      value: (key: string) => key === 'CapsLock',
    });
    fireEvent(password, capsEvent);
    expect(screen.getByText('Caps Lock is on')).toBeVisible();
    expect(password).toHaveAttribute('aria-describedby', 'login-caps-lock');
    fireEvent.blur(password);
    expect(screen.queryByText('Caps Lock is on')).not.toBeInTheDocument();
  });

  it('recovers from a network failure with generic feedback and restores retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private network failure')));
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'player@example.invalid' },
    });
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), {
      target: { value: 'Existing password' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not sign in with those details',
    );
    expect(screen.queryByText('private network failure')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    expect(screen.getByLabelText('Email address')).toBeEnabled();
  });
});
