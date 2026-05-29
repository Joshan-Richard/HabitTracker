// Service Worker for HabitFlow PWA
const CACHE_NAME = 'habitflow-v3';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// ── URLs that should NEVER be cached or intercepted ──────────────────────────
const SKIP_URLS = [
    'firestore.googleapis.com',
    'firebase.googleapis.com',
    'firebaseio.com',
    'googleapis.com',
    'google.com/images',
    'chrome-extension',
    'localhost:5173/__vite',   // vite HMR websocket / dev internals
    'ws://',
    'wss://'
];

function shouldSkip(url) {
    return SKIP_URLS.some(pattern => url.includes(pattern));
}

// ── Install: pre-cache static shell ──────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .catch(err => console.warn('[SW] Pre-cache failed:', err))
    );
    self.skipWaiting();
});

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            )
        )
    );
    self.clients.claim();
});

// ── Fetch: stale-while-revalidate for static, network-only for API ────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = request.url;

    // Only handle GET
    if (request.method !== 'GET') return;

    // Skip anything that should not be intercepted
    if (shouldSkip(url)) return;

    // Skip opaque cross-origin requests that aren't from our origin
    const isOwnOrigin = url.startsWith(self.location.origin);
    const isCdnFont   = url.includes('fonts.gstatic.com') || url.includes('fonts.googleapis.com');

    if (!isOwnOrigin && !isCdnFont) return;

    event.respondWith(
        caches.match(request).then(cached => {
            // Stale-while-revalidate: return cache immediately, update in background
            const networkFetch = fetch(request)
                .then(response => {
                    // Only cache valid same-origin or basic responses
                    if (response && response.ok && (response.type === 'basic' || response.type === 'cors')) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => cache.put(request, clone))
                            .catch(() => {}); // silently ignore cache write errors
                    }
                    return response;
                })
                .catch(() => {
                    // Network failed — if we have cached version return it
                    if (cached) return cached;
                    // For navigation, return the app shell
                    if (request.mode === 'navigate') {
                        return caches.match('/');
                    }
                    // Otherwise let it fail naturally (no 503 spam)
                    return new Response('', { status: 408, statusText: 'Network timeout' });
                });

            return cached || networkFetch;
        })
    );
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
    const data = event.data?.json() || {};
    const title = data.title || 'HabitFlow';
    const options = {
        body: data.body || 'You have a notification',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: [100, 50, 100],
        data: data.data || {},
        actions: [
            { action: 'view',    title: 'View'    },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'dismiss') return;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (const client of clientList) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow('/');
        })
    );
});

// ── Background sync ───────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-completions') {
        event.waitUntil(Promise.resolve()); // Firebase handles its own sync
    }
});
