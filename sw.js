const CACHE_NAME = 'gym-bot-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json'
];

// Install the Service Worker and cache the files
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS);
        })
    );
});

// Serve cached files when offline or loading
self.addEventListener('fetch', event => {
    // Only intercept requests for our frontend files, ignore the API calls to MongoDB
    if (!event.request.url.includes('/api/')) {
        event.respondWith(
            caches.match(event.request).then(response => {
                return response || fetch(event.request);
            })
        );
    }
});