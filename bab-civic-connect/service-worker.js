// Simple PWA service worker for BAB CivicConnect

const CACHE_NAME = "civicconnect-cache-v1";
const ASSETS = [
    "/bab-civic-connect/",
    "/bab-civic-connect/index.html",
    "/bab-civic-connect/app.html",
    "/bab-civic-connect/login.html",
    "/bab-civic-connect/register.html",
    "/bab-civic-connect/profile.html",
    "/bab-civic-connect/responders.html",
    "/bab-civic-connect/reset-password.html",
    "/bab-civic-connect/update-password.html",
    "/bab-civic-connect/css/civicconnect.css",
    "/bab-civic-connect/js/civicconnect-auth.js",
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js",
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
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
        )
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
            if (cached) {
                return cached;
            }
            return fetch(req).catch((err) => {
                console.warn("Fetch failed (offline?):", err);
                // You can return a fallback page or asset here if you like
            });
        })
    );
});