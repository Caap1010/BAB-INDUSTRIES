// Simple PWA service worker for BAB CivicConnect

const CACHE_NAME = "civicconnect-cache-v2";
const ASSETS = [
    "./",
    "./index.html",
    "./app.html",
    "./login.html",
    "./register.html",
    "./profile.html",
    "./responders.html",
    "./reset-password.html",
    "./update-password.html",
    "./css/civicconnect.css",
    "./js/civicconnect-auth.js",
    "./assets/images/civic-connect.png"
];

// Install: cache core assets
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS).catch((err) => {
                console.warn("Service worker cache addAll error:", err);
            });
        })
    );
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.map((key) =>
                    key !== CACHE_NAME ? caches.delete(key) : Promise.resolve()
                )
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch: try cache first, fall back to network
self.addEventListener("fetch", (event) => {
    const req = event.request;

    // Only handle GET requests
    if (req.method !== "GET") {
        return;
    }

    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;

            return fetch(req)
                .then((networkResponse) => {
                    // Cache same-origin successful GET responses for better offline support.
                    if (
                        req.url.startsWith(self.location.origin) &&
                        networkResponse &&
                        networkResponse.status === 200
                    ) {
                        const clone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                    }
                    return networkResponse;
                })
                .catch((err) => {
                    console.warn("Fetch failed (offline?):", err);
                    if (req.mode === "navigate") {
                        return caches.match("./index.html");
                    }
                    return undefined;
                });
        })
    );
});