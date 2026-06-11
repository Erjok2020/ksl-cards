# KSL Cards Backend

This folder contains the Django API that powers KSL Cards.

## What it does

The backend handles:

- account registration and sign-in
- lesson and flashcard data
- progress tracking
- token-based authentication for the React frontend

## Run it locally

```bash
cd backend
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

## API endpoints

- `POST /api/register/` - create a new account
- `POST /api/login/` - sign in and receive an auth token
- `GET /api/lessons/` - list available lessons
- `GET /api/lessons/:id/cards/` - fetch cards for one lesson
- `POST /api/progress/` - save lesson completion
- `GET /api/progress/me/` - view the current user's progress

## Notes

- SQLite is the default database for local development.
- For MySQL, set `DJANGO_DB_ENGINE=mysql` and provide `DJANGO_DB_PASSWORD`.
- CORS is enabled so the Vite frontend can talk to the API during development.
- If the API is unavailable, the frontend falls back to cached lesson data where possible.
