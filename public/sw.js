const CACHE = 'terradagaroa-crackers-v1'
const SHELL = ['/', '/manifest.webmanifest', '/terradagaroa-logo.png']
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL))))
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (event) => { if (event.request.method === 'GET') event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request))) })
