import { pwaStrings } from '@/constants/strings/pwa';
export const CACHE_NAME = 'scalesquad-static-v3';
export const OFFLINE_URL = '/offline';
export const notificationText = {
  MATCH_STARTED: pwaStrings.yourSquadHasStartedAMatch,
  EVIDENCE_AVAILABLE: pwaStrings.newPrivateEvidenceIsReady,
  LOCK_PASSED_TO_YOU: pwaStrings.youNowHaveEditControl,
  RUN_COMPLETED: pwaStrings.aRunHasFinished,
  MATCH_FINISHED: pwaStrings.yourMatchHasFinished,
} as const;
export function shouldCache(
  request: Pick<Request, 'method' | 'url' | 'mode'>,
  response: Pick<Response, 'status' | 'headers' | 'type'>,
  origin: string,
): boolean {
  const url = new URL(request.url, origin);
  if (
    request.method !== 'GET' ||
    url.origin !== origin ||
    request.mode === 'navigate' ||
    response.status !== 200 ||
    response.type === 'opaque'
  )
    return false;
  if (
    response.headers.has('set-cookie') ||
    /no-store|private|no-cache/i.test(response.headers.get('cache-control') ?? '')
  )
    return false;
  if (/text\/html|text\/x-component/i.test(response.headers.get('content-type') ?? ''))
    return false;
  return (
    url.search === '' &&
    (/^\/_next\/static\//.test(url.pathname) ||
      /^\/icons\/(icon-192|icon-512|maskable-512|apple-touch-icon|favicon-32)\.png$/.test(
        url.pathname,
      ) ||
      url.pathname === '/icons/squad-link.svg' ||
      /^\/fonts\/[a-zA-Z0-9_.-]+\.woff2$/.test(url.pathname))
  );
}
export function oldCache(name: string): boolean {
  return name !== CACHE_NAME;
}
export function pushMessage(
  value: unknown,
): { kind: keyof typeof notificationText; matchId: string } | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).length !== 2 ||
    typeof v.kind !== 'string' ||
    !Object.hasOwn(notificationText, v.kind) ||
    typeof v.matchId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(v.matchId)
  )
    return null;
  return { kind: v.kind as keyof typeof notificationText, matchId: v.matchId };
}
