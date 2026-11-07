'use client';
import { layoutClassName } from '@/styles/layout';

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
      <CardHeader className={layoutClassName('brief-header')}>
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
            <p className={layoutClassName('eyebrow')}>
              {card.role} / {card.phase === 'BRIEFING' ? 'OPENING BRIEF' : 'INCIDENT UPDATE'}
            </p>
            <ul className="fact-list list-disc pl-5 text-sm leading-7">
              {card.facts.map((f) => (
                <li key={f.id} className="pb-2.5">
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
          <p className={layoutClassName('muted')}>Your brief will arrive when the host starts.</p>
        )}
        <p className={layoutClassName('muted text-sm')}>
          Tell your squad what matters. Your evidence is never shared automatically.
        </p>
        <Button
          className={layoutClassName('brief-action')}
          disabled={busy || acknowledged || cards.length === 0}
          onClick={onAcknowledge}
        >
          {acknowledged ? 'Acknowledged ✓' : 'I’ve read my evidence'}
        </Button>
      </CardContent>
    </Card>
  );
}
