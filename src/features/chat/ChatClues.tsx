'use client';
import { LockKeyhole } from 'lucide-react';
import type { EvidenceCard } from '@scalesquad/shared';
import { Button } from '@/components/ui/button';
import { roleLabels } from './types';
export function ChatClues({
  cards,
  onDraft,
}: {
  cards: EvidenceCard[];
  onDraft: (text: string) => void;
}) {
  return (
    <div className="space-y-5 py-2">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <LockKeyhole className="size-4" aria-hidden="true" />
        Only your evidence appears here.
      </p>
      {cards.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          Your private clues arrive when the host starts the match.
        </p>
      ) : (
        cards.map((card) => (
          <section key={card.id} className="space-y-3">
            <h3 className="text-sm font-medium">
              {roleLabels[card.role]}:{' '}
              {card.phase === 'BRIEFING' ? 'Opening brief' : 'Incident update'}
            </h3>
            <ul className="divide-y divide-border">
              {card.facts.map((fact) => (
                <li key={fact.id} className="space-y-2 py-4">
                  <p className="break-words text-sm leading-6">{fact.text}</p>
                  <Button
                    variant="outline"
                    className="min-h-11 transition-none"
                    onClick={() => onDraft(fact.text)}
                  >
                    Add to draft
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
