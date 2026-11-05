import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { AuthForm } from '../../src/features/auth/AuthForm';
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
    render(<AuthForm mode="login" />);
    const email = screen.getByLabelText('Email'),
      password = screen.getByLabelText('Password');
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
    fireEvent.change(email, { target: { value: 'ada@example.invalid' } });
    fireEvent.change(password, { target: { value: 'long passphrase' } });
    fireEvent.click(screen.getByText('Show password'));
    expect(password).toHaveAttribute('type', 'text');
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);
    expect(screen.getByRole('button', { name: 'Please wait…' })).toBeDisabled();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not sign in with those details',
    );
  });
  it('register shows one generic success state and live length hints', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: 'Registration complete. You can sign in now.' }), {
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    render(<AuthForm mode="register" />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.invalid' } });
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'river lantern marble cloud' },
    });
    expect(screen.getByText(/✓ 12–128/)).toBeInTheDocument();
    fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form')!);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Registration complete. You can sign in now.',
    );
  });
  it('login offers signup without unavailable email recovery links', () => {
    render(<AuthForm mode="login" />);
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'href',
      '/register',
    );
    expect(screen.queryByRole('link', { name: /forgot|verify/i })).not.toBeInTheDocument();
  });
});
