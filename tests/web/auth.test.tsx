import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { LoginForm } from '../../src/features/auth/LoginForm';

afterEach(() => {
  cleanup();
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
});
