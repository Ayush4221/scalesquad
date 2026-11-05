import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { SignupForm } from '../../src/features/auth/SignupForm';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fillForm() {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: '  Alex Morgan  ' } });
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'ALEX@example.invalid' },
  });
  fireEvent.change(screen.getByLabelText('Password', { exact: true }), {
    target: { value: 'River!12' },
  });
}

function submit() {
  fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form')!);
}

describe('signup flow', () => {
  it('shows a live eight-character checklist and blocks passwords missing a required character', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<SignupForm />);
    const checklist = within(screen.getByRole('list', { name: 'Password requirements' }));
    expect(checklist.getByText('At least 8 characters')).toBeVisible();
    expect(checklist.getAllByText('Not met:')).toHaveLength(4);
    fillForm();
    expect(checklist.getAllByText('Met:')).toHaveLength(4);
    for (const value of ['river!12', 'River!!!', 'River123']) {
      fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value } });
      submit();
      expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      expect(checklist.getAllByText('Not met:')).toHaveLength(1);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it('shows useful field errors, focuses the first invalid input and makes no request', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<SignupForm />);
    submit();
    expect(screen.getByLabelText('Full name')).toHaveFocus();
    expect(screen.getAllByRole('alert')).toHaveLength(3);
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true');
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'invalid email' },
    });
    submit();
    expect(screen.getByText('Enter a valid email address.')).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a short passphrase and preserves password-manager and reveal support', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<SignupForm />);
    fillForm();
    const password = screen.getByLabelText('Password', { exact: true });
    expect(password).toHaveAttribute('autocomplete', 'new-password');
    fireEvent.change(password, { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(password).toHaveValue('short');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
    submit();
    expect(password).toHaveAttribute(
      'aria-describedby',
      'signup-password-requirements signup-password-error',
    );
    expect(
      screen.getByText(
        'Use 8–128 characters with at least one uppercase letter, one special character and one number.',
      ),
    ).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('normalizes the shared DTO, prevents duplicate submits and offers a clean sign-in step', async () => {
    let finish!: (response: Response) => void;
    const fetch = vi.fn(
      (_url: RequestInfo | URL, _options?: RequestInit) =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetch);
    render(<SignupForm />);
    fillForm();
    const form = screen.getByRole('button', { name: 'Create account' }).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({
      name: 'Alex Morgan',
      email: 'alex@example.invalid',
      password: 'River!12',
    });
    expect(screen.getByRole('button', { name: 'Creating account' })).toBeDisabled();
    expect(screen.getByLabelText('Password', { exact: true })).toBeDisabled();
    finish(new Response('{}', { headers: { 'Content-Type': 'application/json' } }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Registration complete. You can sign in now.',
    );
    expect(screen.getByRole('link', { name: 'Continue to sign in' })).toHaveAttribute(
      'href',
      '/signin',
    );
    expect(screen.queryByLabelText('Password', { exact: true })).not.toBeInTheDocument();
  });

  it('keeps failures generic, retains entered values and allows retry', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('private database failure'))
      .mockResolvedValueOnce(new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    render(<SignupForm />);
    fillForm();
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Check your details and try again.');
    expect(screen.queryByText('private database failure')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Password', { exact: true })).toHaveValue('River!12');
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
    submit();
    expect(await screen.findByRole('status')).toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
