/* ═══════════════════════════════════════════════════════
   GEN — Service Worker v3.0
   PWA completo: cache offline, notificações, sync
═══════════════════════════════════════════════════════ */

const CACHE_NAME = 'gen-v4';
const DYNAMIC_CACHE = 'gen-dynamic-v4';

// Arquivos para cache imediato no install
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './icon-192.png',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Rajdhani:wght@300;400;500;600;700&family=Share+Tech+Mono&display=swap',
];

// ═══ INSTALL ═══
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return Promise.allSettled(
          PRECACHE_URLS.map(url =>
            cache.add(url).catch(() => {
              // Falha silenciosa para URLs externas
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ═══ ACTIVATE ═══
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== DYNAMIC_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ═══ FETCH — Estratégia: Cache First para assets, Network First para dados ═══
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições não-GET e chrome-extension
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.href.includes('chrome-extension')) return;

  // Fontes Google — Cache First (longa duração)
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.open(DYNAMIC_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(response => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // App shell — Cache First com fallback para network
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        const fetchPromise = fetch(request)
          .then(response => {
            if (response && response.status === 200 && response.type !== 'opaque') {
              caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
            }
            return response;
          })
          .catch(() => null);

        // Retorna cache imediatamente se existir, senão espera network
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Outros — Network First com fallback para cache
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// ═══ PUSH NOTIFICATIONS ═══
self.addEventListener('push', event => {
  let data = { title: '⚡ GEN', body: 'Continue sua evolução!', icon: '⚡' };

  if (event.data) {
    try { data = { ...data, ...event.data.json() }; }
    catch (e) { data.body = event.data.text(); }
  }

  const options = {
    body: data.body,
    icon: data.icon || './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'gen-notification',
    renotify: true,
    requireInteraction: false,
    actions: [
      { action: 'open', title: '🧬 Abrir GEN' },
      { action: 'dismiss', title: '✕ Fechar' }
    ],
    data: { url: './', timestamp: Date.now() }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ═══ NOTIFICATION CLICK ═══
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Foca janela existente
        for (const client of clientList) {
          if (client.url.includes('index.html') || client.url.endsWith('/')) {
            return client.focus();
          }
        }
        // Abre nova janela
        return clients.openWindow('./');
      })
  );
});

// ═══ BACKGROUND SYNC ═══
self.addEventListener('sync', event => {
  if (event.tag === 'gen-sync') {
    event.waitUntil(
      // Placeholder para sync futuro com backend
      Promise.resolve()
    );
  }
});

// ═══ MESSAGE — Comunicação com o app ═══
self.addEventListener('message', event => {
  const { type, payload } = event.data || {};

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (type === 'CACHE_URLS' && payload?.urls) {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then(cache =>
        Promise.allSettled(payload.urls.map(url => cache.add(url).catch(() => {})))
      )
    );
    return;
  }

  if (type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(keys =>
        Promise.all(keys.map(k => caches.delete(k)))
      )
    );
    return;
  }

  // Responde com status do cache
  if (type === 'GET_CACHE_STATUS') {
    caches.keys().then(keys => {
      event.ports[0]?.postMessage({
        caches: keys,
        cacheName: CACHE_NAME,
        version: 'v3.0'
      });
    });
  }
});

// ═══ PERIODIC BACKGROUND SYNC (quando suportado) ═══
self.addEventListener('periodicsync', event => {
  if (event.tag === 'gen-daily-reminder') {
    event.waitUntil(
      self.registration.showNotification('⚡ GEN — Lembrete Diário', {
        body: 'Não esqueça de registrar seus hábitos hoje!',
        icon: './icon-192.png',
        tag: 'gen-daily',
        requireInteraction: false,
      })
    );
  }
});
