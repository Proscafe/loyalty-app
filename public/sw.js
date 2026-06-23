self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "Pro's Cafe",
      body: event.data ? event.data.text() : "You have a new notification.",
    };
  }

  const title = data.title || "Pro's Cafe";
  const options = {
    body: data.body || "You have a new notification.",
    icon: data.icon || "/apple-icon.png",
    badge: data.badge || "/apple-icon.png",
    data: {
      url: data.url || "/dashboard",
      notificationId: data.notificationId || null,
      type: data.type || "Announcements",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (clients.openWindow) return clients.openWindow(targetUrl);
      return undefined;
    }),
  );
});
