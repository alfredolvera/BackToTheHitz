// CAMBIO: Incrementa la versión y actualiza el nombre del archivo de imagen
const CACHE_NAME = 'back-to-the-hitz-v21'; 

const URLS_TO_CACHE = [
  '/',
  'index.html',
  'rules.html',
  'style.css',
  'rules.css',
  'script.js',
  'weblogo.png',
  'biff.gif', // <-- CAMBIO DE .jpg A .gif
  'effect.mp3',
  'main.mp3',
  'icons/favicon.ico',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto, guardando app shell en:', CACHE_NAME);
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName.startsWith('back-to-the-hitz-') &&
                 cacheName !== CACHE_NAME;
        }).map(cacheName => {
          console.log('Borrando caché antiguo:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});