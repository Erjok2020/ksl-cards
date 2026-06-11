# KSL Cards

KSL Cards is a small Kenya Sign Language learning app built with a Django API and a React + TypeScript frontend. It is meant to feel simple to use, keep working when the connection drops, and stay light enough to run locally without a lot of setup.

## What’s in here

- [backend/README.md](backend/README.md) for the Django API
- [frontend/README.md](frontend/README.md) for the React app
- offline-friendly lesson caching and progress sync in the frontend

## Run the backend

```bash
cd backend
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

## Run the frontend

```bash
cd frontend
npm install
npm run dev
```

## Frontend scripts

- `npm run dev` starts the Vite dev server.
- `npm run build` creates the production bundle.
- `npm run lint` checks the code with ESLint.
- `npm run typecheck` runs the TypeScript compiler without writing files.

## Offline behavior

- The last signed-in user is restored from localStorage.
- Lessons are cached so the dashboard still opens when the API is offline.
- Lesson cards are cached per lesson.
- Progress updates are queued locally and sent later when the app reconnects.

## API endpoints

- `POST /api/register/` to create an account
- `POST /api/login/` to sign in and receive a token
- `GET /api/lessons/` to list lessons
- `GET /api/lessons/:id/cards/` to load lesson cards
- `POST /api/progress/` to save completion
- `GET /api/progress/me/` to view your progress
