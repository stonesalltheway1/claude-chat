/**
 * Claude Chat Service Worker
 * Optimized for production with Workbox 7.0
 * 
 * Features:
 * - Advanced caching strategies with stale-while-revalidate for assets
 * - Navigation preload for faster page loads
 * - Offline fallback page
 * - Background sync for offline operation
 * - Periodic background sync for content refreshes
 * - Notification handling
 * - Cache cleanup and management
 * 
 * @version 2.0.0
 * @updated 2025-03-24
 */

// Import Workbox from CDN (automatically versioned)
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

// Workbox configuration
workbox.setConfig({
  debug: false
});

// Use the latest features
workbox.core.setCacheNameDetails({
  prefix: 'claude-chat',
  suffix: 'v2',
  precache: 'app-shell',
  runtime: 'runtime'
});

// Force update on page refresh
self.skipWaiting();
workbox.core.clientsClaim();

// App shell (critical) resources
const APP_SHELL = [
  '/',
  '/index.html',
  '/offline.html',
  '/assets/css/main.css',
  '/assets/js/app.js'
];

// Extended non-critical resources
const EXTENDED_ASSETS = [
  '/assets/css/chat.css',
  '/assets/css/components.css',
  '/assets/css/settings.css',
  '/assets/css/utils.css',
  '/assets/js/api.js',
  '/assets/js/ui.js',
  '/assets/js/settings.js',
  '/assets/js/theme.js',
  '/assets/js/utils.js',
  '/assets/img/favicon.png',
  '/assets/img/apple-touch-icon.png',
  '/manifest.json'
];

// Cache names
const CACHE_NAMES = {
  appShell: 'app-shell-v2.0.0',
  assets: 'assets-v2.0.0',
  images: 'images-v2.0.0',
  fonts: 'fonts-v2.0.0',
  api: 'api-cache-v2.0.0',
  docs: 'docs-v2.0.0'
};

// Version data to track updates
const VERSION_INFO = {
  version: '2.0.0',
  buildDate: '2025-03-24',
  cacheTTL: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
};

// Cache app shell during installation
workbox.precaching.precacheAndRoute(
  APP_SHELL.map(url => ({
    url,
    revision: VERSION_INFO.version
  }))
);

// Enable navigation preload for faster page loads
workbox.navigationPreload.enable();

/**
 * Cache strategies for different content types
 */

// HTML navigation - Network first with offline fallback
workbox.routing.registerRoute(
  ({ request }) => request.mode === 'navigate',
  new workbox.strategies.NetworkFirst({
    cacheName: CACHE_NAMES.appShell,
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 24 * 60 * 60 // 24 hours
      }),
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      // Provide offline fallback
      {
        handlerDidError: async () => {
          return await caches.match('/offline.html');
        }
      }
    ]
  })
);

// CSS, JS - Stale while revalidate for best performance/freshness balance
workbox.routing.registerRoute(
  ({ request }) => 
    request.destination === 'script' || 
    request.destination === 'style',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: CACHE_NAMES.assets,
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
      }),
      new workbox.broadcastUpdate.BroadcastUpdatePlugin({
        channelName: 'asset-updates',
        headersToCheck: ['etag', 'content-length']
      })
    ]
  })
);

// Images - Cache first for performance, with network fallback
workbox.routing.registerRoute(
  ({ request }) => request.destination === 'image',
  new workbox.strategies.CacheFirst({
    cacheName: CACHE_NAMES.images,
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        purgeOnQuotaError: true
      }),
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200]
      })
    ]
  })
);

// Fonts - Cache first with long expiration
workbox.routing.registerRoute(
  ({ request }) => request.destination === 'font',
  new workbox.strategies.CacheFirst({
    cacheName: CACHE_NAMES.fonts,
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
      })
    ]
  })
);

// API responses - Network only with error handling for sensitive data
workbox.routing.registerRoute(
  ({ url }) => url.pathname.includes('/api/') && !url.pathname.includes('/v1/messages'),
  new workbox.strategies.NetworkOnly({
    plugins: [
      {
        handlerDidError: async ({ request }) => {
          // Return a specific offline response for API
          return new Response(JSON.stringify({ 
            error: 'You are currently offline. Please check your connection.' 
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    ]
  })
);

// Documentation files - Network first with longer cache
workbox.routing.registerRoute(
  ({ url }) => url.pathname.includes('/docs/'),
  new workbox.strategies.NetworkFirst({
    cacheName: CACHE_NAMES.docs,
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 14 * 24 * 60 * 60 // 14 days
      })
    ]
  })
);

// Exclude certain patterns from caching
workbox.routing.registerRoute(
  ({ url }) => 
    url.pathname.includes('/v1/messages') || 
    url.pathname.includes('/analytics/') ||
    url.pathname.includes('/user-data/'),
  new workbox.strategies.NetworkOnly()
);

/**
 * Background Sync for offline operations
 */
workbox.routing.registerRoute(
  ({ url }) => url.pathname === '/api/messages',
  new workbox.strategies.NetworkOnly({
    plugins: [
      new workbox.backgroundSync.BackgroundSyncPlugin('messages-queue', {
        maxRetentionTime: 24 * 60 // Retry for 24 hours (specified in minutes)
      })
    ]
  }),
  'POST'
);

// Handle API key updates when offline
workbox.routing.registerRoute(
  ({ url }) => url.pathname === '/api/settings',
  new workbox.strategies.NetworkOnly({
    plugins: [
      new workbox.backgroundSync.BackgroundSyncPlugin('settings-queue', {
        maxRetentionTime: 24 * 60 // Retry for 24 hours
      })
    ]
  }),
  'PUT'
);

/**
 * Periodic Background Sync to update content regularly
 * Requires permission granted by the user
 */
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-content') {
    event.waitUntil(updateContent());
  }
});

// Function to update cached content
async function updateContent() {
  try {
    // Refresh app shell cache
    const cache = await caches.open(CACHE_NAMES.appShell);
    
    // Update critical app shell resources
    for (const url of APP_SHELL) {
      await cache.add(url);
    }
    
    // Update non-critical resources in the background
    for (const url of EXTENDED_ASSETS) {
      fetch(url).then(response => {
        if (response.ok) {
          cache.put(url, response);
        }
      }).catch(err => console.error(`Failed to update ${url}:`, err));
    }
    
    // Notify clients about the update
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({
        type: 'CONTENT_UPDATED',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log('Background content update completed');
  } catch (error) {
    console.error('Background update failed:', error);
  }
}

/**
 * Handle notifications
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    
    const options = {
      body: data.message || 'New notification',
      icon: '/assets/img/notification-icon.png',
      badge: '/assets/img/notification-badge.png',
      tag: data.tag || 'default',
      data: {
        url: data.url || '/',
        ...data.data
      },
      vibrate: [100, 50, 100],
      actions: data.actions || [
        {
          action: 'view',
          title: 'View'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Claude Chat', options)
    );
  } catch (error) {
    console.error('Push notification error:', error);
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if a window client is already open
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no window is open, open a new one
      return clients.openWindow(urlToOpen);
    })
  );
});

/**
 * Handle service worker messages
 */
self.addEventListener('message', (event) => {
  // Skip waiting for immediate activation
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Clear specific cache
  else if (event.data?.type === 'CLEAR_CACHE' && event.data?.cacheName) {
    event.waitUntil(
      caches.delete(event.data.cacheName)
    );
  }
  
  // Check for updates
  else if (event.data?.type === 'CHECK_VERSION') {
    event.ports[0].postMessage({
      type: 'VERSION_INFO',
      version: VERSION_INFO
    });
  }
});

/**
 * Cache cleanup logic
 */
// Clean up old caches during activation
self.addEventListener('activate', (event) => {
  const expectedCacheNames = Object.values(CACHE_NAMES);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheName.includes(VERSION_INFO.version) && 
              expectedCacheNames.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated with cache cleanup');
      return self.clients.claim();
    })
  );
});

/**
 * Range request support for media files
 */
workbox.routing.registerRoute(
  ({ request }) => request.headers.has('range'),
  async ({ request }) => {
    try {
      const url = new URL(request.url);
      const cache = await caches.open(CACHE_NAMES.assets);
      let response = await cache.match(request.url);

      if (!response) {
        response = await fetch(request);
        if (response.ok) {
          await cache.put(request.url, response.clone());
        }
      }

      // If response doesn't support range request, we need to handle it
      if (!response.headers.has('accept-ranges') || response.headers.get('accept-ranges') === 'none') {
        // We need to read the entire response and construct a new one
        const body = await response.arrayBuffer();
        const headers = new Headers(response.headers);
        headers.set('accept-ranges', 'bytes');

        // Parse range header
        const rangeHeader = request.headers.get('range');
        if (rangeHeader) {
          const matches = rangeHeader.match(/bytes=(\d+)-(\d+)?/);
          if (matches) {
            const start = parseInt(matches[1], 10);
            const end = matches[2] ? parseInt(matches[2], 10) : body.byteLength - 1;
            const slicedBody = body.slice(start, end + 1);
            
            headers.set('content-length', slicedBody.byteLength.toString());
            headers.set('content-range', `bytes ${start}-${end}/${body.byteLength}`);
            
            return new Response(slicedBody, {
              status: 206,
              headers
            });
          }
        }
      }
      
      return response;
    } catch (err) {
      console.error('Range request failed:', err);
      return fetch(request);
    }
  }
);

// Register share target handler
workbox.routing.registerRoute(
  '/share-target/',
  async ({ event }) => {
    const formData = await event.request.formData();
    
    // Store shared data temporarily
    const shareData = {
      title: formData.get('title') || '',
      text: formData.get('text') || '',
      url: formData.get('url') || '',
      file: formData.get('file')
    };
    
    // Store share data in IndexedDB for the application to access
    const db = await openDB('claude-chat-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('shared-content')) {
          db.createObjectStore('shared-content');
        }
      }
    });
    
    await db.put('shared-content', shareData, 'latest-share');
    
    // Redirect to the app's share handler
    return Response.redirect('/?share=true', 303);
  },
  'POST'
);

/**
 * Helper functions
 */
// Simple IndexedDB wrapper for share target handling
async function openDB(name, version, { upgrade }) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = e => upgrade(e.target.result);
    request.onsuccess = e => resolve(wrapDB(e.target.result));
    request.onerror = () => reject(request.error);
  });
}

// Wrap IndexedDB with async methods
function wrapDB(db) {
  return {
    async put(storeName, value, key) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(value, key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => resolve(request.result);
      });
    }
  };
}

// Log successful installation
console.log(`Claude Chat Service Worker v${VERSION_INFO.version} installed successfully.`);