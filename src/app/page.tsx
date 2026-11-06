import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/auth';
import { LandingPage } from '@/features/landing/LandingPage';
export default async function Home() {
  if (await getCurrentUser()) redirect('/play');
  return <LandingPage />;
}
