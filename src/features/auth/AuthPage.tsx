import { AuthForm, type AuthMode } from './AuthForm';
export function AuthPage({ mode }: { mode: AuthMode }) {
  return (
    <main className="entry">
      <a href="/signin" className="wordmark">
        ▦ SCALE<span>SQUAD</span>
      </a>
      <div className="entry-card">
        <AuthForm mode={mode} />
      </div>
    </main>
  );
}
