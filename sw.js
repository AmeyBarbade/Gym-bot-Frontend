const CACHE_NAME = 'gym-bot-v4'; // Bumped version to force cache clear
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/manifest.json'
    // NOTE: app.js NOT cached - it will always fetch fresh
];

// 1. Install & Force Update
self.addEventListener('install', event => {
    self.skipWaiting(); // Forces the browser to activate this new version immediately
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

// 2. Clean Up Old Caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys.map(key => {
                if (key !== CACHE_NAME) {
                    console.log('🗑️ Deleting old cache:', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim(); // Claim all clients immediately
});

// 3. Intercept Fetch Requests
self.addEventListener('fetch', event => {
    // 🔥 NEVER cache app.js - always fetch fresh for latest code
    if (event.request.url.includes('app.js')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // 🔥 NEVER cache anything from your Render API!
    if (event.request.url.includes('onrender.com') || event.request.url.includes('/api/')) {
        event.respondWith(fetch(event.request)); // Go straight to the internet
        return;
    }

    // Otherwise, serve static files (HTML/CSS) from cache, or fallback to internet
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});