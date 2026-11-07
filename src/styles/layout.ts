import { cn } from '@/utils/classNames';

/** Shared layout recipes. Marker names are test hooks, never global CSS selectors. */
const styles: Record<string, string> = {
  'page-shell': 'mx-auto max-w-[1440px] px-10 pb-16 max-[650px]:px-[18px] max-[650px]:pb-8',
  topbar:
    'flex h-22 items-center justify-between gap-4 border-b border-border max-md:h-auto max-md:min-h-18 max-md:flex-wrap max-md:py-3',
  wordmark:
    'inline-flex w-fit shrink-0 items-center gap-2.5 whitespace-nowrap font-sans text-xl leading-none font-black tracking-[-0.8px] text-foreground no-underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-6 max-[650px]:gap-[7px] max-[650px]:text-[15px] max-[650px]:tracking-[-0.4px]',
  'wordmark-mark': 'block size-11 shrink-0 max-[650px]:size-[34px]',
  'wordmark-name': 'inline-flex',
  'wordmark-accent': 'text-primary',
  eyebrow: 'mb-[18px] font-mono text-[11px] tracking-[2px] text-muted-foreground',
  'match-intro': 'max-w-[650px] text-base leading-[1.7] text-muted-foreground',
  footnote: 'mt-10 font-mono text-xs text-subtle-foreground',
  'match-heading':
    'pt-10 pb-[30px] max-md:py-6 [&_h1]:mb-3 [&_h1]:text-4xl [&_h1]:font-bold [&_h1]:tracking-[-1px] max-[650px]:[&_h1]:text-[28px]',
  'goal-strip': 'mt-6 flex flex-wrap gap-[22px] font-mono text-xs text-primary max-[650px]:gap-3',
  'match-grid': 'grid grid-cols-[minmax(0,1fr)_340px] gap-6 max-[1000px]:grid-cols-1',
  muted: 'text-muted-foreground leading-[1.6]',
  'run-grid': 'grid grid-cols-1 gap-5',
  metrics:
    'grid grid-cols-4 gap-3 max-[650px]:grid-cols-2 [&_strong]:block [&_strong]:text-[23px] [&_span]:text-[11px] [&_span]:text-muted-foreground',
  'reason-list':
    'list-none p-0 [&_li]:border-t [&_li]:border-border [&_li]:py-3 [&_li]:text-[13px] [&_li]:leading-normal [&_strong]:font-mono [&_strong]:text-[10px] [&_strong]:text-warning [&_small]:text-[10px] [&_small]:text-subtle-foreground [&_summary]:flex [&_summary]:min-h-11 [&_summary]:cursor-pointer [&_summary]:items-center',
  error:
    'mb-5 rounded-lg border border-error-border bg-error-background px-[18px] py-3.5 text-destructive',
  'play-again': 'inline-block py-4 text-primary',
  'safe-area-view':
    'min-h-dvh overscroll-none [padding:env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)]',
  'status-bar':
    'sticky top-0 z-20 flex flex-wrap gap-3 border-b border-border bg-background py-3 text-xs [&_[data-connection=connected]]:text-primary [&_[data-connection=reconnecting]]:text-destructive [&_[data-connection=offline]]:text-destructive',
  'bottom-nav':
    'hidden max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:grid max-md:grid-cols-5 max-md:gap-0.5 max-md:border-t max-md:border-input max-md:bg-card max-md:px-1 max-md:pt-2 max-md:pb-[calc(8px+env(safe-area-inset-bottom))] [&_button]:rounded-lg [&_button]:px-0.5 [&_button]:py-2 [&_button]:text-xs [&_button]:[overflow-wrap:anywhere] [&_[aria-current=page]]:bg-success-background [&_[aria-current=page]]:text-primary [&_button:disabled]:opacity-40',
  'pwa-banner':
    'relative z-30 flex flex-wrap items-center justify-center gap-3 bg-success-background px-4 py-2.5 text-sm',
  'run-overlay':
    'fixed inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-page-overlay p-6 text-center [&_h2]:text-[28px] [&_h2]:font-bold',
  'mobile-metrics': 'hidden max-md:grid max-md:gap-3',
  'desktop-metrics': 'max-md:hidden',
  'metric-card':
    'min-w-0 rounded-xl border border-input p-4 [&_p]:my-2.5 [&_p]:text-[22px] [&_small]:text-muted-foreground',
  'brief-header': 'max-md:sticky max-md:top-14 max-md:z-10 max-md:bg-card',
  'repair-header': 'max-md:sticky max-md:top-14 max-md:z-10 max-md:bg-card',
  'brief-action': 'max-md:sticky max-md:bottom-21 max-md:z-10 max-md:bg-card max-md:py-2',
  'lobby-actions': 'max-md:sticky max-md:bottom-21 max-md:z-10 max-md:bg-card max-md:py-2',
  'match-shell':
    'max-md:pb-[calc(88px+env(safe-area-inset-bottom))]! max-md:[&[data-tab=Chat]_.match-heading]:hidden max-md:[&[data-tab=Chat]>.topbar]:hidden max-md:[&[data-tab=Chat]_.match-grid>div]:hidden',
  'tab-brief': 'max-md:[.match-shell:not([data-tab=Brief])_&]:hidden',
  'tab-squad': 'max-md:[.match-shell:not([data-tab=Squad])_&]:hidden',
  'tab-repair': 'max-md:[.match-shell:not([data-tab=Repair])_&]:hidden',
  'tab-results': 'max-md:[.match-shell:not([data-tab=Results])_&]:hidden',
  'tab-chat': 'max-md:[.match-shell:not([data-tab=Chat])_&]:hidden',
  'mobile-drawer':
    'max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:max-h-[85dvh] max-md:w-full max-md:max-w-full max-md:translate-none max-md:overflow-auto max-md:rounded-t-2xl max-md:rounded-b-none max-md:px-[18px] max-md:pt-6 max-md:pb-[calc(24px+env(safe-area-inset-bottom))]',
};

export function layoutClassName(names: string): string {
  return cn(...names.split(/\s+/).flatMap((name) => [name, styles[name]]));
}
