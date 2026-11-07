/** Shared by Next Proxy and the HTTP server; no framework or Node dependencies. */
export function buildContentSecurityPolicy({
  appOrigin,
  nonce,
  development = false,
}: {
  appOrigin: string;
  nonce?: string;
  development?: boolean;
}): string {
  const ws = appOrigin.replace(/^http/, 'ws');
  // Server API and browser SDK use different domains. The SDK's region defaults
  // route navigation, WebSocket and cloud-control requests through light-edge.
  const chatHosts = [
    'sg-light-api.com',
    'us-light-api.com',
    'sau-light-api.com',
    'sg-light-edge.com',
    'us-light-edge.com',
    'sau-light-edge.com',
  ]
    .flatMap((host) => [`https://*.${host}`, `wss://*.${host}`])
    .join(' ');
  const scripts = [
    "'self'",
    ...(nonce ? [`'nonce-${nonce}'`, "'strict-dynamic'"] : []),
    ...(development ? ["'unsafe-eval'"] : []),
  ].join(' ');
  return [
    "default-src 'self'",
    `script-src ${scripts}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://avatars.githubusercontent.com https://lh3.googleusercontent.com",
    "font-src 'self' data:",
    `connect-src 'self' ${ws} https://*.nexconn.ai wss://*.nexconn.ai ${chatHosts}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",
  ].join('; ');
}
