/// <reference lib="webworker" />
/**
 * KSL Cards service worker (proposal Section 3.5, sequence diagram flows 1-2).
 *
 * - App shell: precached on first load, so the app opens with no network.
 * - Lesson text (API GETs): network first, falling back to the last copy.
 * - Sign videos/posters: served from the "ksl-media" cache ONLY when the
 *   learner downloaded that module. Videos are never cached automatically,
 *   because they are large (FR-05). Range requests are answered from the
 *   cached file so videos can seek and play offline in every browser.
 */
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { createPartialResponse } from "workbox-range-requests";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<string | { url: string; revision: string | null }> };

export const MEDIA_CACHE = "ksl-media";
export const API_CACHE = "ksl-api";

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Single-page app: every navigation gets index.html from the precache.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//, /^\/media\//, /^\/admin/, /^\/static\//],
  }),
);

// Lesson list, lesson cards, progress, lesson checks, FAQ and policy pages:
// fresh when online, the last saved copy when not.
registerRoute(
  ({ url, request }) =>
    request.method === "GET" &&
    /^\/api\/(lessons\/|lessons\/\d+\/cards\/|progress\/me\/|quiz-attempts\/|faq\/|pages\/[\w-]+\/)$/.test(url.pathname),
  new NetworkFirst({
    cacheName: API_CACHE,
    networkTimeoutSeconds: 5,
    plugins: [new ExpirationPlugin({ maxEntries: 200 })],
  }),
);

// Sign media: cache only if downloaded, otherwise straight to the network.
registerRoute(
  ({ url, request }) => request.method === "GET" && url.pathname.startsWith("/media/"),
  async ({ request }) => {
    const cache = await caches.open(MEDIA_CACHE);
    const cached = await cache.match(request.url);
    if (cached) {
      if (request.headers.has("range")) {
        return createPartialResponse(request, cached);
      }
      return cached;
    }
    return fetch(request);
  },
);

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});
