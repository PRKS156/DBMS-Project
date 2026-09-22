const CACHE_NAME = "meddispatch-v2"; // bumped version — forces cleanup of the old stuck cache
const urlsToCache = ["/index.html"];

self.addEventListener("install", (event) => {
  self.skipWaiting(); // activate the new service worker immediately, don't wait
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim(); // take control of already-open tabs right away
});

self.addEventListener("fetch", (event) => {
  // Always fetch the actual page fresh from the network first
  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match(event.request)) // only use cache if genuinely offline
    );
    return;
  }

  // Static assets (icons, fonts, etc.) — fine to reuse from cache
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});

self.addEventListener("push", (event) => {
    const data = event.data ? event.data.json() : { title: "Emergency Alert", body: "New alert received." };
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            vibrate: [200, 100, 200]
        })
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow("/"));
});