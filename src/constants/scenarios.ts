import type { ScenarioId } from '@scalesquad/shared';

/** Public mission descriptions only. Hidden traffic, budgets and repairs stay server-side. */
export const scenarioCatalog = [
  {
    id: 'campuspass',
    title: 'CampusPass',
    focus: 'The original mission',
    description: 'Keep festival check-in moving. Admit each pass once and stay within budget.',
    source: null,
  },
  {
    id: 'retry-storm',
    title: 'Retry Storm',
    focus: 'Retries and lost responses',
    description:
      'A scanner times out after a successful check-in. The crowd retries. Recover confirmations without admitting anyone twice.',
    source: { label: 'Stripe: safe retries', url: 'https://stripe.com/blog/idempotency' },
  },
  {
    id: 'split-gates',
    title: 'Split Gates',
    focus: 'Network failure and recovery',
    description:
      'Three entrances lose their connection. Pending scans pile up. Reconnect safely before the admission deadline.',
    source: {
      label: 'GitHub: network partition incident',
      url: 'https://github.blog/news-insights/company-news/oct21-post-incident-analysis/',
    },
  },
  {
    id: 'flash-crowd',
    title: 'Flash Crowd',
    focus: 'Burst traffic and capacity',
    description:
      'Doors open and traffic surges. Find the bottleneck and protect single-use passes without overspending.',
    source: {
      label: 'Shopify: flash-sale engineering',
      url: 'https://shopify.engineering/surviving-flashes-of-high-write-traffic-using-scriptable-load-balancers-part-i',
    },
  },
] as const satisfies ReadonlyArray<{
  id: ScenarioId;
  title: string;
  focus: string;
  description: string;
  source: { label: string; url: string } | null;
}>;
