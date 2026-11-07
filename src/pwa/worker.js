/* Build inlines swLogic.ts above this file. Never cache user data. */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const response = await fetch(OFFLINE_URL, { cache: 'reload', credentials: 'omit' });
      if (response.ok) await cache.put(OFFLINE_URL, response);
    }),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter(oldCache).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
  if (event.data?.type === 'PURGE')
    event.waitUntil(
      caches
        .keys()
        .then((names) => Promise.all(names.map((name) => caches.delete(name))))
        .then(() => event.ports[0]?.postMessage({ ok: true })),
    );
});
self.addEventListener('fetch', (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(
        async () =>
          (await caches.match(OFFLINE_URL)) ??
          new Response(pwaStrings.offlineReconnectToPlay, {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          }),
      ),
    );
    return;
  }
  // API, RSC and other dynamic requests never enter Cache Storage.
  if (
    !shouldCache(
      request,
      new Response('', { headers: { 'Content-Type': 'application/octet-stream' } }),
      self.location.origin,
    )
  )
    return;
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (shouldCache(request, response, self.location.origin))
        await cache.put(request, response.clone());
      return response;
    }),
  );
});
self.addEventListener('push', (event) => {
  let message = null;
  try {
    message = pushMessage(event.data?.json());
  } catch {
    return;
  }
  if (!message) return;
  const { kind, matchId } = message;
  event.waitUntil(
    self.registration.showNotification(commonStrings.scalesquad, {
      body: notificationText[kind],
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `${kind}:${matchId}`,
      data: { matchId },
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const matchId = event.notification.data?.matchId;
  if (typeof matchId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(matchId)) return;
  const url = new URL(`/match/${matchId}`, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const client = clients.find((c) => c.url === url);
      if (client) return client.focus();
      return self.clients.openWindow(url);
    }),
  );
});
