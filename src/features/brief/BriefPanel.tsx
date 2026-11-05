'use client';
import type { EvidenceCard } from '@scalesquad/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
export function BriefPanel({
  cards,
  acknowledged,
  busy,
  onAcknowledge,
  onShare,
}: {
  cards: EvidenceCard[];
  acknowledged: boolean;
  busy: boolean;
  onAcknowledge: () => void;
  onShare?: (text: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="brief-header">
        <div className="flex items-center justify-between">
          <CardTitle>Your evidence</CardTitle>
          <Badge variant="outline">◇ Private · only you</Badge>
        </div>
        {!acknowledged && cards.some((card) => card.phase === 'INCIDENT_EVIDENCE') && (
          <p role="status">New private evidence. Read your update before continuing.</p>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {cards.map((card) => (
          <section key={card.id}>
            <p className="eyebrow">
              {card.role} / {card.phase === 'BRIEFING' ? 'OPENING BRIEF' : 'INCIDENT UPDATE'}
            </p>
            <ul className="fact-list">
              {card.facts.map((f) => (
                <li key={f.id}>
                  {f.text}
                  {onShare && (
                    <Button variant="ghost" onClick={() => onShare(f.text)}>
                      Share to squad…
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {cards.length === 0 && (
          <p className="muted">Your brief will arrive when the host starts.</p>
        )}
        <p className="muted text-sm">
          Tell your squad what matters. Your evidence is never shared automatically.
        </p>
        <Button
          className="brief-action"
          disabled={busy || acknowledged || cards.length === 0}
          onClick={onAcknowledge}
        >
          {acknowledged ? 'Acknowledged ✓' : 'I’ve read my evidence'}
        </Button>
      </CardContent>
    </Card>
  );
}
