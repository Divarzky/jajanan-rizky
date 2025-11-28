// service-worker.js
'use strict';

const CACHE_VERSION = 'v2.0';
const CACHE_NAME = `riski-kasir-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

// Install event - precache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching app shell');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        console.log('Skip waiting on install');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME)
            .map(k => {
              console.log('Deleting old cache:', k);
              return caches.delete(k);
            })
      );
    }).then(() => {
      console.log('Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - network first with cache fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // Handle navigation requests (HTML pages)
  if (isNavigationRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the updated page
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone))
            .catch(err => console.log('Cache put error:', err));
          return response;
        })
        .catch(() => {
          // Offline - return cached version
          return caches.match(event.request)
            .then(cached => cached || caches.match('/index.html'));
        })
    );
    return;
  }
  
  // For static assets, try cache first
  if (PRECACHE_URLS.some(staticUrl => url.pathname.endsWith(staticUrl))) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) {
            // Update cache in background
            fetch(event.request)
              .then(response => {
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(event.request, response));
              })
              .catch(() => {}); // Ignore fetch errors
            return cached;
          }
          return fetch(event.request);
        })
    );
    return;
  }
  
  // For other requests, network first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful requests
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // Offline - try cache
        return caches.match(event.request);
      })
  );
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
         (request.method === 'GET' && 
          request.headers.get('accept')?.includes('text/html'));
}

// Handle messages from the app
self.addEventListener('message', (event) => {
  const data = event.data;
  
  if (!data) return;
  
  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      caches.keys().then(keys => {
        keys.forEach(k => caches.delete(k));
      });
      break;
      
    case 'GET_VERSION':
      event.ports[0]?.postMessage({ version: CACHE_VERSION });
      break;
  }
});