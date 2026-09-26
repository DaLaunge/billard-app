/* Push-Teil des Service Workers - wird per workbox.importScripts in den von
   vite-plugin-pwa generierten sw.js eingebunden (siehe vite.config.js).

   Ist die App gerade OFFEN und im Vordergrund, zeigen wir keine System-
   Benachrichtigung, sondern reichen die Nachricht an die App weiter, die
   sie als Toast zeigt (sonst kaeme dieselbe Meldung doppelt). Ausnahme:
   Safari/iOS - Apple verlangt zu JEDEM Push eine sichtbare Benachrichtigung
   und entzieht die Push-Erlaubnis, wenn das mehrfach nicht passiert. */

const isApple = /Safari/.test(self.navigator.userAgent)
  && !/Chrome|Chromium|Android|Edg|Firefox|OPR/.test(self.navigator.userAgent);

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: event.data?.text() }; }
  const title = data.title || "Break & Rank";

  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const visible = wins.filter((c) => c.visibilityState === "visible");
    if (visible.length > 0 && !isApple) {
      visible.forEach((c) => c.postMessage({ type: "push-notification", notification: data }));
      return;
    }
    await self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-mono-192.png",
      tag: data.kind ? `${data.kind}:${data.id ?? ""}` : undefined,
      data: { nav: data.nav || null, id: data.id ?? null },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const nav = event.notification.data?.nav || null;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const win = wins[0];
    if (win) {
      await win.focus();
      if (nav) win.postMessage({ type: "push-nav", nav });
      return;
    }
    const url = nav ? "/?nav=" + encodeURIComponent(JSON.stringify(nav)) : "/";
    await self.clients.openWindow(url);
  })());
});
