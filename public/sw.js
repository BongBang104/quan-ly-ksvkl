// ATC PRO — Service Worker
// Xử lý Web Push Notifications (background + foreground khi app bị đóng)

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// ─── Push event: hiển thị notification ────────────────────────────────────
self.addEventListener('push', e => {
  const defaults = {
    title: 'ATC PRO',
    body:  'Bạn có thông báo mới.',
    icon:  '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    url:   '/',
  };

  let data = defaults;
  try {
    data = { ...defaults, ...e.data.json() };
  } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    data.icon,
      badge:   data.badge,
      vibrate: [200, 100, 200],
      data:    { url: data.url },
      // Gộp notification cùng tag để tránh chồng nhiều thông báo
      tag:     'atc-pro',
      renotify: true,
    }),
  );
});

// ─── Notification click: mở / focus app ───────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const targetUrl = e.notification.data?.url ?? '/';

  e.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        // Nếu tab đang mở thì focus, không mở tab mới
        const existing = list.find(c => c.url.startsWith(self.location.origin));
        if (existing) return existing.focus();
        return self.clients.openWindow(targetUrl);
      }),
  );
});
