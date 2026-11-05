import { signIn } from '@/auth';
import { AuthForm } from '@/features/auth/AuthForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
export const dynamic = 'force-dynamic';
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const error = (await searchParams).error;
  return (
    <main className="entry">
      <div className="wordmark">
        ▦ SCALE<span>SQUAD</span>
      </div>
      <p className="eyebrow">THREE ENGINEERS. ONE SYSTEM. ZERO DUPLICATES.</p>
      <h1>
        Build together.
        <br />
        <span>Survive the incident.</span>
      </h1>
      <p className="intro">
        Your squad has different pieces of the puzzle. Share what you know. Repair CampusPass. Prove
        it works.
      </p>
      <Card className="entry-card">
        <CardHeader>
          <CardTitle>Join the control room</CardTitle>
          <CardDescription>A three-player systems game.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <p role="alert" className="error">
              {error === 'OAuthAccountNotLinked'
                ? 'Use your original sign-in method for this email.'
                : 'Could not sign in. Try again.'}
            </p>
          )}
          <AuthForm mode="login" />
          {(process.env.AUTH_GOOGLE_ID || process.env.AUTH_GITHUB_ID) && (
            <p className="muted text-center">or</p>
          )}
          {process.env.AUTH_GOOGLE_ID && (
            <form
              action={async () => {
                'use server';
                await signIn('google', { redirectTo: '/play' });
              }}
            >
              <Button className="w-full" size="lg" type="submit">
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
        </CardContent>
      </Card>
      <p className="footnote">CampusPass · One pass, one admission.</p>
    </main>
  );
}
