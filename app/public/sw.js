// Minimal service worker — required for Add-to-Home-Screen on iOS Safari.
// Phase 2 will add proper offline caching via @serwist/next.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  /* network-only passthrough for now */
});
