// ====================================================
// sw.js — Service Worker — ÓticaVision Pro
// Estratégia: Cache-First para assets estáticos
//             Network-First para dados dinâmicos
// ====================================================

const CACHE_NAME = 'oticavision-v2';
const STATIC_CACHE = 'oticavision-static-v2';
const DYNAMIC_CACHE = 'oticavision-dynamic-v2';

// Assets que serão cacheados na instalação (shell da aplicação)
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png',
  './apple-touch-icon.png',
  './favicon-32x32.png',
  // FontAwesome via CDN será cacheado dinamicamente na primeira visita
];

// CDNs permitidos para cache dinâmico
const CACHEABLE_HOSTS = [
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

// ─── INSTALL ───────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando... v1');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Pré-cacheando shell da aplicação');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ──────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => {
            console.log('[SW] Removendo cache antigo:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ─── FETCH ─────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requests não-GET
  if (request.method !== 'GET') return;

  // Ignora extensões do navegador e outros protocolos
  if (!request.url.startsWith('http')) return;

  // ── Estratégia: Cache First para assets estáticos locais ──
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── Estratégia: Cache First para CDNs (FontAwesome, jsPDF, etc.) ──
  if (CACHEABLE_HOSTS.some((host) => url.hostname.includes(host))) {
    event.respondWith(cacheFirst(request, DYNAMIC_CACHE));
    return;
  }

  // ── Estratégia: Network First para todo o resto ──
  event.respondWith(networkFirst(request));
});

// ─── ESTRATÉGIAS ───────────────────────────────────

/**
 * Cache First: retorna do cache; se não tiver, busca na rede e cacheia.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return offlineFallback(request);
  }
}

/**
 * Network First: tenta rede; se falhar, usa cache; se não tiver, retorna fallback.
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cached = await caches.match(request);
    return cached || offlineFallback(request);
  }
}

/**
 * Fallback offline: retorna a página principal cacheada.
 */
async function offlineFallback(request) {
  if (request.headers.get('accept')?.includes('text/html')) {
    const cached = await caches.match('./index.html');
    return cached || new Response('<h1>Offline</h1><p>Sem conexão com a internet.</p>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  return new Response('', { status: 408, statusText: 'Offline' });
}

// ─── BACKGROUND SYNC (futuro) ──────────────────────
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  // Aqui pode-se implementar sincronização de dados offline
});

// ─── PUSH NOTIFICATIONS (futuro) ──────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'ÓticaVision Pro', {
    body: data.body || '',
    icon: './icon-192x192.png',
    badge: './icon-72x72.png',
    vibrate: [200, 100, 200],
    data: data,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      if (clientList.length > 0) return clientList[0].focus();
      return clients.openWindow('./');
    })
  );
});
