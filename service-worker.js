const CACHE_NAME = "riski-kasir-v1";

const FILES = [
    "index.html",
    "style.css",
    "app.js",
    "manifest.json",
    "icons/icon-512.png"
];

self.addEventListener("install", e => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(FILES)));
});

self.addEventListener("fetch", e => {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
