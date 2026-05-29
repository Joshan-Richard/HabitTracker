// Service Worker for HabitFlow PWA
const CACHE_NAME = 'habitflow-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip Chrome extensions
    if (event.request.url.includes('chrome-extension')) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Return cached response if available
            if (cachedResponse) {
                // Fetch and cache new version in background
                fetch(event.request).then((response) => {
                    if (response.ok) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, response);
                        });
                    }
                });
                return cachedResponse;
            }

            // Fetch from network
            return fetch(event.request).then((response) => {
                // Cache successful responses
                if (response.ok && (event.request.url.startsWith('http') || event.request.url.startsWith('https'))) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        try {
                            if (responseClone && responseClone.type === 'basic' && (event.request.url.startsWith('http') || event.request.url.startsWith('https'))) {
                                cache.put(event.request, responseClone).catch(err => {
                                    // Suppress specific cache errors
                                    console.debug('Cache put failed:', err);
                                });
                            }
                        } catch (err) {
                            console.warn('Failed to cache response:', err);
                        }
                    });
                }
                return response;
            }).catch(() => {
                // Return offline page for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match('/');
                }
                return new Response('Offline', { status: 503 });
            });
        })
    );
});

// Push notification event
self.addEventListener('push', (event) => {
    const data = event.data?.json() || {};
    const title = data.title || 'HabitFlow';
    const options = {
        body: data.body || 'You have a notification',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        vibrate: [100, 50, 100],
        data: data.data || {},
        actions: [
            { action: 'view', title: 'View' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'dismiss') return;

    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            // Focus existing window if available
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Open new window
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

// Background sync for offline completions
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-completions') {
        event.waitUntil(syncCompletions());
    }
});

async function syncCompletions() {
    // Sync logic would go here when using Firebase
    console.log('Syncing completions...');
}
