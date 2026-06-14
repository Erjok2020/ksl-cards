# KSL Cards

**Live demo:** coming soon

KSL Cards is a learning app for Kenya Sign Language. You go through lessons, flip through cards, and your progress gets saved. It works even when your internet cuts out — lessons stay cached and progress syncs back up when you reconnect.

Built with Django on the backend and React + TypeScript on the frontend.

---

## What you need before starting

Make sure you have these installed on your machine:

- Python 3.10 or newer
- Node.js 18 or newer
- MySQL (running locally)

---

## Getting the backend running

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

The API will be live at `http://127.0.0.1:8000`.

### Environment variables

Create a `.env` file in the `backend` folder if you want to customize things:

```env
DJANGO_SECRET_KEY=your-secret-key
DJANGO_DEBUG=true
DJANGO_DB_NAME=ksl_cards
DJANGO_DB_USER=root
DJANGO_DB_PASSWORD=your-password
DJANGO_DB_HOST=127.0.0.1
DJANGO_DB_PORT=3306
```

Without these, it falls back to SQLite for the database and debug mode stays off.

---

## Getting the frontend running

```bash
cd frontend
npm install
npm run dev
```

The app will open at `http://localhost:5173`.

### Frontend scripts

- `npm run dev` — starts the local dev server
- `npm run build` — builds the app for production
- `npm run lint` — checks for code issues
- `npm run typecheck` — checks TypeScript types without building

---

## Deploying

### Backend on Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo** → pick this repo
3. Set the root directory to `backend`
4. Add a MySQL database — click **New** → **Database** → **MySQL**
5. Go to your backend service → **Settings** → **Networking** → click **Generate Domain**
6. Add these environment variables under the **Variables** tab:

```env
DJANGO_SECRET_KEY=any-long-random-string
DJANGO_ALLOWED_HOSTS=your-app.up.railway.app
DJANGO_DEBUG=false
DJANGO_DB_NAME=railway
DJANGO_DB_USER=root
DJANGO_DB_PASSWORD=from Railway MySQL variables tab
DJANGO_DB_HOST=from Railway MySQL variables tab
DJANGO_DB_PORT=3306
```

1. After deploy, open the Railway shell and run:

```bash
python manage.py migrate
```

### Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **New Project** → import this repo
3. Set root directory to `frontend`
4. Build command: `npm run build`, output: `dist`
5. Add this environment variable:

```env
VITE_API_URL=https://your-app.up.railway.app
```

1. Deploy — Vercel gives you a live URL ending in `.vercel.app`

---

## Works offline too

- Last signed-in user is remembered so you don't get logged out
- Lessons load from cache when the API is unreachable
- Cards are cached per lesson
- Any progress you make offline gets synced when you come back online

---

## API endpoints

| Method | Endpoint | What it does |
| ------ | -------- | ------------ |
| POST | `/api/register/` | Create an account |
| POST | `/api/login/` | Sign in and get a token |
| GET | `/api/lessons/` | List all lessons |
| GET | `/api/lessons/:id/cards/` | Get cards for a lesson |
| POST | `/api/progress/` | Save your progress |
| GET | `/api/progress/me/` | See your progress |

---

## More details

- [backend/README.md](backend/README.md) — Django API setup and notes
- [frontend/README.md](frontend/README.md) — React app setup and notes
