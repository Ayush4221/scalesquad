import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/auth';
export default async function Home() {
  redirect((await getCurrentUser()) ? '/play' : '/signin');
}
