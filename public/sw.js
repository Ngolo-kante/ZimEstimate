// ZimEstimate Service Worker
// Provides offline caching for critical app resources

const CACHE_NAME = 'zimestimate-v2';
const DYNAMIC_CACHE = 'zimestimate-dynamic-v2';

// Resources to cache on install
const STATIC_ASSETS = [
    '/',
    '/home',
    '/projects',
    '/analytics',
    '/supplier/analytics',
    '/marketplace',
    '/templates',
    '/market-insights',
    '/ai',
    '/offline',
    '/manifest.json',
];

// Cache strategies
const CACHE_FIRST_PATTERNS = [
    /\.(?:js|css|woff2?|ttf|otf|eot)$/,
    /\/static\//,
];

const NETWORK_FIRST_PATTERNS = [
    /\/api\//,
    /\/projects\//,
    /\/boq\//,
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        })
    );

    // Activate immediately
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME && name !== DYNAMIC_CACHE)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        })
    );

    // Take control of all clients immediately
    self.clients.claim();
});

// Fetch event - handle requests with appropriate strategy
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip Chrome extension requests
    if (url.protocol === 'chrome-extension:') {
        return;
    }

    // Determine caching strategy based on URL pattern
    if (CACHE_FIRST_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
        event.respondWith(cacheFirst(request));
    } else if (NETWORK_FIRST_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
        event.respondWith(networkFirst(request));
    } else {
        event.respondWith(staleWhileRevalidate(request));
    }
});

// Cache-first strategy for static assets
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        console.log('[SW] Cache-first failed:', request.url, error);
        return new Response('Offline', { status: 503 });
    }
}

// Network-first strategy for dynamic content
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            const offlinePage = await caches.match('/offline');
            if (offlinePage) return offlinePage;
        }

        console.log('[SW] Network-first failed:', request.url, error);
        return new Response('Offline', { status: 503 });
    }
}

// Stale-while-revalidate for pages
async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(() => {
        // If network fails and we have no cache, return offline page
        if (request.mode === 'navigate') {
            return caches.match('/offline');
        }
        return undefined;
    });

    return cachedResponse || (await fetchPromise) || new Response('Offline', { status: 503 });
}

// Handle messages from the app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CACHE_ESTIMATE') {
        const projectId = event.data.projectId;
        const data = event.data.data;
        cacheEstimateData(projectId, data);
    }
});

// Push notifications
// SW-001 FIX: Add try-catch to prevent service worker crash on malformed JSON
self.addEventListener('push', (event) => {
    let data = {};

    if (event.data) {
        try {
            data = event.data.json();
        } catch (parseError) {
            console.error('[SW] Failed to parse push notification payload:', parseError);
            // Try to get text if JSON fails
            try {
                const text = event.data.text();
                data = { body: text };
            } catch (textError) {
                console.error('[SW] Failed to get push notification text:', textError);
            }
        }
    }

    const title = data.title || 'ZimEstimate';
    const options = {
        body: data.body || 'You have a new notification.',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        data: {
            url: data.url || '/notifications',
        },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(url) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
            return undefined;
        })
    );
});

// Cache estimate data for offline access
async function cacheEstimateData(projectId, data) {
    try {
        const cache = await caches.open(DYNAMIC_CACHE);
        const response = new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' },
        });
        await cache.put('/api/estimates/' + projectId, response);
        console.log('[SW] Cached estimate:', projectId);
    } catch (error) {
        console.error('[SW] Failed to cache estimate:', error);
    }
}
