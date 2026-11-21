import { act } from '@testing-library/react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SignOutButton } from '../../src/features/auth/SignOutButton';

describe('sign-out startup readiness', () => {
  it.each([false, true])('waits for the handler before enabling logout (all=%s)', async (all) => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<SignOutButton all={all} />);
    document.body.append(container);
    let root: Root | undefined;
    try {
      const button = container.querySelector('button');
      expect(button).toBeDisabled();
      await act(async () => {
        root = hydrateRoot(container, <SignOutButton all={all} />);
      });
      expect(button).toBeEnabled();
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  });
});
