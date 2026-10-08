// Dedicated service worker for Web Push notifications.
// Not an app-shell SW. Does not cache navigation.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "OMNI Flow Lab", body: "Você tem uma nova notificação" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (_) {
    if (event.data) payload.body = event.data.text();
  }
  const { title, body, link, tag, icon } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: tag || "omni",
      icon: icon || "/icon-192.png",
      badge: "/icon-192.png",
      data: { link: link || "/notificacoes" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.link) || "/notificacoes";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
