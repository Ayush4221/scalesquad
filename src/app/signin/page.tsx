import { appStrings } from '@/constants/strings/app';
import { signIn } from '@/auth';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { LoginForm } from '@/features/auth/LoginForm';
import { Button } from '@/components/ui/button';
import styles from '@/features/auth/auth.module.css';
import motion from '@/features/auth/login.module.css';
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
            ? appStrings.useYourOriginalSignInMethod
            : appStrings.couldNotSignInTryAgain}
        </p>
      )}
      <LoginForm />
      {(process.env.AUTH_GOOGLE_ID || process.env.AUTH_GITHUB_ID) && (
        <div className={styles.providers}>
          <p className={styles.providerDivider}>{appStrings.orContinueWith}</p>
          {process.env.AUTH_GOOGLE_ID && (
            <form
              action={async () => {
                'use server';
                await signIn('google', { redirectTo: '/play' });
              }}
            >
              <Button className={motion.providerButton} variant="outline" size="lg" type="submit">
                {appStrings.continueWithGoogle}
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
              <Button className={motion.providerButton} variant="outline" size="lg" type="submit">
                {appStrings.continueWithGithub}
              </Button>
            </form>
          )}
        </div>
      )}
    </AuthLayout>
  );
}
