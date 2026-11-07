import { Headphones, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function VoiceChannel() {
  return (
    <section
      aria-labelledby="voice-channel-title"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
    >
      <div className="min-w-0">
        <h3 id="voice-channel-title" className="flex items-center gap-2 text-sm font-medium">
          <Headphones className="size-4 text-muted-foreground" aria-hidden="true" />
          Squad voice
          <span className="rounded bg-secondary/15 px-2 py-0.5 text-xs font-medium text-foreground">
            BETA
          </span>
        </h3>
        <p id="voice-availability" className="mt-1 text-xs text-muted-foreground">
          Coming soon for your three-person squad.
        </p>
      </div>
      <Button
        disabled
        variant="outline"
        aria-describedby="voice-availability"
        className="min-h-11 transition-none"
      >
        <Mic aria-hidden="true" />
        Join voice
      </Button>
    </section>
  );
}
