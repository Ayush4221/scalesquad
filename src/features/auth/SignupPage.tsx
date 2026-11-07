import { AuthLayout } from './AuthLayout';
import { SignupForm } from './SignupForm';

export function SignupPage() {
  return (
    <AuthLayout variant="signup">
      <SignupForm />
    </AuthLayout>
  );
}
