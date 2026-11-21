/** Initialize Node dependencies even when Next starts without the custom server. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureAuthAdapter } = await import('./server/repositories/authRepository');
    ensureAuthAdapter();
  }
}
