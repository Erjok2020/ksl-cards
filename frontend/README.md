# KSL Cards Frontend

This is the React frontend for KSL Cards. It uses TypeScript and Vite, and it keeps working even when the backend drops out for a bit.

## Scripts

- `npm run dev` - start the local dev server
- `npm run build` - bundle the app for production
- `npm run lint` - check the code with ESLint
- `npm run typecheck` - run the TypeScript compiler without writing files

## Offline behavior

- Restores the saved signed-in user from `localStorage`
- Falls back to cached lessons when the backend is unavailable
- Stores lesson cards per lesson for quick reloads
- Queues progress updates locally until the connection comes back
