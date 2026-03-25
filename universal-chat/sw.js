const CACHE_NAME = "nexus-static-v1";
const ASSETS = [
    "./",
    "index.html",
    "login.html",
    "feed.html",
    "messages.html",
    "reels.html",
    "profile.html",
    "manifest.json",
    "icon.svg",
    "css/main.css",
    "js/config.js",
    "js/auth.js",
    "js/utils.js",
    "js/icons.js",
    "js/app.js",
    "js/feed.js",
    "js/chat.js",
    "js/reels.js",
    "js/profile.js"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => Promise.resolve())
    );
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return;

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request)
                .then(response => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                    return response;
                })
                .catch(() => caches.match("index.html"));
        })
    );
});

self.addEventListener("push", event => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch (_) {
        payload = {};
    }

    const title = payload.title || "NEXUS";
    const options = {
        body: payload.body || "New activity in your universe.",
        icon: "icon.svg",
        badge: "icon.svg",
        data: {
            url: payload.url || "feed.html"
        }
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || "feed.html";
    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
            for (const client of list) {
                if (client.url.includes(targetUrl) && "focus" in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(targetUrl);
            return null;
        })
    );
});
