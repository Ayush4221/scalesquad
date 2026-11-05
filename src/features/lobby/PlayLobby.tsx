'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PublicMatchView } from '@scalesquad/shared';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHydrated } from '@/lib/useHydrated';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
export function PlayLobby({ name }: { name: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function enter(join: boolean) {
    setBusy(true);
    setError('');
    try {
      const view = PublicMatchView.parse(
        await api(join ? '/matches/join' : '/matches', join ? { code } : {}),
      );
      router.push(`/match/${view.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not enter squad');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="hero">
        <p className="eyebrow">CAMPUSPASS / INCIDENT SIMULATION 01</p>
        <h1>
          Your next incident
          <br />
          starts <span>with a squad.</span>
        </h1>
        <p className="intro">
          Welcome, {name}. Gather three engineers. Each gets private evidence. Together, build a
          system that admits every pass exactly once.
        </p>
      </section>
      <div className="lobby-grid">
        <Card>
          <CardHeader>
            <p className="eyebrow">01 / HOST</p>
            <CardTitle>Open a control room</CardTitle>
            <CardDescription>
              Start a squad and invite two teammates with your code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled={!hydrated || busy} onClick={() => void enter(false)} size="lg">
              Create squad →
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <p className="eyebrow">02 / JOIN</p>
            <CardTitle>Your squad is waiting</CardTitle>
            <CardDescription>Enter the eight-character code from your host.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void enter(true);
              }}
            >
              <Input
                aria-label="Join code"
                disabled={!hydrated || busy}
                placeholder="SQUAD CODE"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <Button type="submit" disabled={!hydrated || busy || code.length !== 8}>
                Join →
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="principles">
        <span>↗ Handle the surge</span>
        <span>◇ Protect single-use passes</span>
        <span>◷ Stay within budget</span>
      </div>
    </>
  );
}
