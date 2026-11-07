import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/auth';
import { MatchShell } from '@/features/lobby/MatchShell';
export default async function Match({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/signin');
  const { id } = await params;
  return <MatchShell key={`${user.userId}:${id}`} matchId={id} userId={user.userId} />;
}
