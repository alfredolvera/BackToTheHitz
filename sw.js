const CACHE_NAME = 'back-to-the-hitz-v25';

const URLS_TO_CACHE = [
  '/',
  'index.html',
  'rules.html',
  'style.css',
  'rules.css',
  'script.js',
  'manifest.json',
  'weblogo.png',
  'biff.gif',
  'effect.mp3',
  'main.mp3',
  'icons/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames
        .filter(cacheName => cacheName.startsWith('back-to-the-hitz-') && cacheName !== CACHE_NAME)
        .map(cacheName => caches.delete(cacheName))
    ))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
