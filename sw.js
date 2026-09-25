const CACHE_NAME = 'back-to-the-hitz-v30';

const URLS_TO_CACHE = [
  '/',
  'index.html',
  'guest.html',
  'guest.js',
  'rules.html',
  'style.css',
  'rules.css',
  'script.js',
  'manifest.json',
  'weblogo.png',
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
  if (event.request.method !== 'GET' || new URL(event.request.url).pathname.startsWith('/.netlify/functions/')) return;
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
