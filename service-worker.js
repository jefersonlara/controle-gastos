/* Controle de Gastos — service worker
   Cacheia o "app shell" para abrir instantaneamente e funcionar
   offline. Os dados em si ficam no localStorage, não aqui.

   Ao publicar uma atualização do app, troque o número da versão
   abaixo (CACHE_NAME) para forçar o iPhone a buscar os arquivos
   novos. */
const CACHE_NAME = 'controle-gastos-v4';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './auth-config.js',
  './google-sync.js',
  './auth.js',
  './manifest.json',
  './xlsx.mini.min.js',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first para o app shell, com atualização em segundo plano.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Deixa passar direto tudo que não for do próprio site (ex.: login e APIs
  // do Google em accounts.google.com / googleapis.com). Nunca cachear isso.
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
