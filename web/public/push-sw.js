/* eslint-disable */
/**
 * Push handlers, pulled into the generated service worker by `workbox.importScripts`.
 *
 * Imported rather than written as a full custom worker (`injectManifest`), because taking that
 * route would mean re-implementing the precache routing by hand — including the
 * `navigateFallbackDenylist` that keeps an offline `/api` navigation from being answered with
 * `index.html`. That behaviour is verified and worth not rewriting to add two event listeners.
 */

self.addEventListener("push", (event) => {
  // A push with no readable payload still has to show something: browsers revoke the
  // permission of a worker that receives a push and displays nothing.
  let payload = {
    title: "Blitz Task",
    body: "You have a new notification",
    url: "/",
  };

  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Malformed payload — fall through to the generic notification above.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/android-chrome-192x192.png",
      badge: "/favicon-32x32.png",
      data: { url: payload.url },
      // Collapses repeats onto one notification rather than stacking a reminder that fires
      // again after a due date moves.
      tag: "blitz-task",
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = event.notification.data?.url || "/";

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Focus a window that is already open rather than adding another. Someone who taps a
      // reminder while the app is open expects to land in it, not in a second copy.
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }

      await self.clients.openWindow(target);
    })(),
  );
});
