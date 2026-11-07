import { cn } from '@/utils/classNames';

/** Landing-specific Tailwind recipes. Hook names remain for links and browser checks. */
const styles: Record<string, string> = {
  hallmarkHome:
    'overflow-x-clip bg-background font-brand-body text-base leading-[1.6] text-foreground [font-synthesis:none] selection:bg-primary selection:text-primary-foreground [&_:is(h1,h2,h3)]:min-w-0 [&_:is(h1,h2,h3)]:break-words [&_:is(h1,h2,h3)]:text-balance [&_p]:text-pretty [&_:is(a,button)]:cursor-pointer [&_:is(a,button)]:focus-visible:outline-3 [&_:is(a,button)]:focus-visible:outline-primary [&_:is(a,button)]:focus-visible:outline-offset-5 [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-55 [&_button[aria-busy=true]]:cursor-progress',
  'hm-container': 'mx-auto w-full max-w-7xl px-10 max-[760px]:px-6',
  'hm-nav':
    'flex items-center justify-between gap-6 py-6 pr-24 max-[760px]:pr-6 max-[420px]:flex-wrap max-[420px]:gap-2 [&_.wordmark]:text-[22px] [&_.wordmark-mark]:size-9',
  'hm-main-nav':
    'flex items-center gap-6 text-sm max-[420px]:w-full max-[420px]:justify-between [&_a]:inline-flex [&_a]:min-h-12 [&_a]:items-center [&_a:hover]:underline [&_a:hover]:underline-offset-6',
  'hm-link':
    'inline-flex min-h-12 items-center justify-center gap-2 border-0 bg-transparent p-0 underline decoration-1 underline-offset-6 hover:decoration-2 active:translate-y-px motion-reduce:transform-none',
  'hm-hero':
    'grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] items-center gap-16 pt-10 pb-16 max-[760px]:grid-cols-[minmax(0,1fr)] max-[760px]:gap-10 max-[760px]:pt-6',
  'hm-headline':
    'max-w-[12ch] font-brand-display text-[clamp(46px,7.6vw,98px)] leading-[1.05] font-normal tracking-normal text-primary max-[760px]:text-[clamp(48px,12vw,76px)]',
  'hm-lede': 'mt-6 max-w-[34ch] text-lg text-muted-foreground',
  'hm-actions':
    'mt-10 flex flex-wrap items-center gap-6 max-[420px]:flex-col max-[420px]:items-start max-[420px]:gap-3',
  'hm-primary':
    'inline-flex min-h-13 items-center gap-3 rounded-sm border-0 bg-primary px-6 py-3 font-bold text-primary-foreground shadow-home-action transition-transform duration-120 ease-home hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-[3px] active:translate-y-[3px] motion-reduce:transform-none motion-reduce:transition-none',
  'hm-role-explorer': 'border-t-2 border-border',
  'hm-role-controls': 'flex flex-col',
  'hm-role-button':
    'flex min-h-13 items-center gap-4 border-0 border-b border-border bg-transparent px-4 py-2 text-left text-lg leading-[1.2] font-semibold transition-transform duration-120 ease-home hover:translate-x-[3px] aria-pressed:bg-primary aria-pressed:text-primary-foreground motion-reduce:transform-none motion-reduce:transition-none',
  'hm-role-index': 'ml-auto text-sm tabular-nums',
  'hm-role-copy':
    'min-h-[225px] pt-6 animate-home-settle motion-reduce:animate-none max-[760px]:min-h-[195px] [&_h2]:text-[44px] [&_h2]:leading-[1.05] [&_h2]:font-black [&_h2]:tracking-[-0.03em] [&_h2]:whitespace-pre-line [&_p]:mt-4 [&_p]:max-w-[35ch] [&_p]:text-base [&_p]:text-muted-foreground',
  'hm-caption': 'border-t border-border pt-4 text-sm text-muted-foreground',
  'hm-mission':
    'bg-secondary py-16 text-foreground [&_h2]:text-[clamp(38px,5vw,64px)] [&_h2]:leading-[1.05] [&_h2]:font-black [&_h2]:tracking-[-0.03em] [&_p]:mt-6 [&_p]:max-w-[34ch] [&_p]:text-lg max-[760px]:[&_p]:text-base',
  'hm-mission-layout':
    'grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] items-center gap-10 max-[760px]:grid-cols-[minmax(0,1fr)]',
  'hm-objectives':
    '[&>div]:border-b [&>div]:border-foreground/40 [&>div]:py-6 [&>div:first-child]:pt-0 [&_dt]:text-[25px] [&_dt]:leading-[1.2] [&_dt]:font-black [&_dd]:mt-2 [&_dd]:text-base',
  'hm-round':
    'py-24 max-[760px]:py-16 [&_h2]:text-[clamp(36px,4.8vw,60px)] [&_h2]:leading-[1.1] [&_h2]:font-black [&_h2]:tracking-[-0.03em]',
  'hm-round-heading':
    'flex items-end justify-between gap-10 max-[760px]:block [&_p]:max-w-[28ch] [&_p]:text-muted-foreground max-[760px]:[&_p]:mt-6 max-[760px]:[&_p]:max-w-[38ch]',
  'hm-round-controls': 'mt-10 flex gap-6 border-b border-border max-[760px]:gap-3',
  'hm-scene-button':
    'min-h-13 flex-1 border-0 border-b-[3px] border-transparent bg-transparent py-2 text-left text-base hover:text-primary aria-pressed:border-primary aria-pressed:text-primary max-[760px]:text-sm',
  'hm-step':
    'grid min-h-75 grid-cols-[minmax(0,0.45fr)_minmax(0,1fr)] items-center gap-10 py-10 animate-home-settle motion-reduce:animate-none max-[760px]:grid-cols-[minmax(0,0.3fr)_minmax(0,1fr)] max-[760px]:gap-6 max-[420px]:min-h-[370px] max-[420px]:grid-cols-[minmax(0,1fr)] max-[420px]:gap-4 [&>span]:font-brand-display [&>span]:text-[clamp(72px,11vw,140px)] [&>span]:leading-none [&>span]:text-primary max-[420px]:[&>span]:text-[64px] [&_h3]:text-[clamp(28px,3.5vw,44px)] [&_h3]:leading-[1.15] [&_h3]:font-black [&_h3]:tracking-[-0.03em] [&_p]:mt-6 [&_p]:max-w-[42ch] [&_p]:text-lg [&_p]:text-muted-foreground',
  'hm-play-row':
    'flex items-center justify-between gap-4 border-t border-border pt-4 max-[420px]:flex-col max-[420px]:items-start [&>span]:text-sm [&>span]:text-muted-foreground',
  'hm-close':
    'pt-10 pb-16 [&_h2]:max-w-[21ch] [&_h2]:text-[clamp(36px,5.6vw,72px)] [&_h2]:leading-[1.08] [&_h2]:font-black [&_h2]:tracking-[-0.03em] [&>.hm-link]:mt-6 [&>.hm-link]:text-xl [&>.hm-link]:text-primary',
  'hm-footer':
    'flex flex-wrap items-center justify-between gap-6 bg-card py-6 text-sm text-foreground max-[420px]:flex-col max-[420px]:items-start max-[420px]:gap-2 [&>span]:text-[23px] [&>span]:font-black [&>a]:inline-flex [&>a]:min-h-12 [&>a]:items-center [&>a]:underline [&>a]:underline-offset-6 [&_p]:text-muted-foreground',
  'hm-action-status':
    'inline-flex size-5 items-center justify-center [&_svg]:size-5 [&_svg]:animate-spin motion-reduce:[&_svg]:animate-none',
  'hm-account-link': 'mt-6 text-primary',
  'hm-skip':
    'absolute top-3 left-3 z-60 -translate-y-[200%] bg-primary px-4 py-3 text-primary-foreground focus:translate-y-0',
};

export function landingClassName(names: string): string {
  return cn(...names.split(/\s+/).flatMap((name) => [name, styles[name]]));
}
