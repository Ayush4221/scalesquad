import { signIn } from '@/auth';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { LoginForm } from '@/features/auth/LoginForm';
import { Button } from '@/components/ui/button';
import styles from '@/features/auth/auth.module.css';
export const dynamic = 'force-dynamic';
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const error = (await searchParams).error;
  return (
    <AuthLayout variant="login">
      {error && (
        <p role="alert" className={styles.serverError}>
          {error === 'OAuthAccountNotLinked'
            ? 'Use your original sign-in method for this email.'
            : 'Could not sign in. Try again.'}
        </p>
      )}
      <LoginForm />
      {(process.env.AUTH_GOOGLE_ID || process.env.AUTH_GITHUB_ID) && (
        <div className={styles.providers}>
          <p className={styles.providerDivider}>or continue with</p>
          {process.env.AUTH_GOOGLE_ID && (
            <form
              action={async () => {
                'use server';
                await signIn('google', { redirectTo: '/play' });
              }}
            >
              <Button variant="outline" size="lg" type="submit">
                Continue with Google
              </Button>
            </form>
          )}
          {process.env.AUTH_GITHUB_ID && (
            <form
              action={async () => {
                'use server';
                await signIn('github', { redirectTo: '/play' });
              }}
            >
              <Button className="w-full" variant="outline" size="lg" type="submit">
                Continue with GitHub
              </Button>
            </form>
          )}
        </div>
      )}
    </AuthLayout>
  );
}
