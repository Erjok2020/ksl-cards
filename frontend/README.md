# KSL Cards Frontend

React + TypeScript + Tailwind CSS, built with Vite as a Progressive Web App.

## Scripts

- `npm run dev` - start the local dev server (the service worker runs in dev too)
- `npm run build` - type-check and bundle the app for production
- `npm run lint` - check the code with ESLint
- `npm run typecheck` - type-check the app and the service worker

## Offline behaviour

- `src/sw/sw.ts` is the Workbox service worker. It precaches the app shell, keeps the last copy of lesson text, and serves sign videos from the `ksl-media` cache only for modules the learner downloaded (with Range support so videos seek offline).
- `src/lib/downloads.ts` downloads or removes a whole module, reports its size, and checks the files are still there.
- `src/lib/progress.ts` queues progress events in IndexedDB and syncs them to `/api/progress/sync/` when online.
- `src/lib/api.ts` handles JWT refresh and falls back to cached data when the network is down.
