const CACHE = 'terradagaroa-crackers-v2'
const STATIC = ['/manifest.webmanifest', '/terradagaroa-logo.png']
self.addEventListener('install', (event) => { self.skipWaiting(); event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC))) })
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('terradagaroa-crackers-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())))
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const request = event.request
  if (request.mode === 'navigate') { event.respondWith(fetch(request).catch(() => caches.match('/'))) ; return }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)); return response })))
})
