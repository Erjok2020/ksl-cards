# KSL Cards

**Live demo:** coming soon

KSL Cards is a small app for learning Kenya Sign Language — go through lessons, flip through cards, and your progress gets saved as you go. It still works when your internet drops: lessons stay cached on your device and progress quietly syncs once you're back online.

Built with Django on the backend and React + TypeScript (via Vite) on the frontend.

---

## Before you start

You'll need these installed:

- Python 3.10+
- Node.js 18+
- MySQL, if you want to run with the same database as production (SQLite works fine for quick local testing)

---

## Running the backend

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

That gets you the API at `http://127.0.0.1:8000`.

By default it uses SQLite, no setup needed. If you want MySQL locally too, drop a `.env` file in `backend` with:

```env
DJANGO_SECRET_KEY=your-secret-key
DJANGO_DEBUG=true
DJANGO_DB_ENGINE=mysql
DJANGO_DB_NAME=ksl_cards
DJANGO_DB_USER=root
DJANGO_DB_PASSWORD=your-password
DJANGO_DB_HOST=127.0.0.1
DJANGO_DB_PORT=3306
```

More backend details (endpoints, what the API actually does) live in [backend/README.md](backend/README.md).

---

## Running the frontend

```bash
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:5173`. Scripts and offline behavior are covered in [frontend/README.md](frontend/README.md).

---

## Deploying (for future reference)

### Backend on Railway

1. Sign in to [railway.app](https://railway.app) with GitHub
2. **New Project** → **Deploy from GitHub repo** → pick this repo, set root directory to `backend`
3. Add a MySQL database to the project: **New** → **Database** → **MySQL**
4. On the backend service, go to **Settings** → **Networking** → **Generate Domain**
5. Add these variables on the backend service:

```env
DJANGO_SECRET_KEY=any-long-random-string
DJANGO_ALLOWED_HOSTS=your-app.up.railway.app
DJANGO_DEBUG=false
DJANGO_DB_ENGINE=mysql
DJANGO_DB_NAME=(copy MYSQLDATABASE from the MySQL service)
DJANGO_DB_USER=(copy MYSQLUSER from the MySQL service)
DJANGO_DB_PASSWORD=(copy MYSQLPASSWORD from the MySQL service)
DJANGO_DB_HOST=(copy MYSQLHOST from the MySQL service)
DJANGO_DB_PORT=(copy MYSQLPORT from the MySQL service)
```

`DJANGO_DB_ENGINE=mysql` is easy to miss but it's the one that actually switches the app from SQLite to MySQL — without it, Railway silently runs on a throwaway SQLite file that gets wiped on every redeploy.

1. Once deployed, open the Railway console and run:

```bash
python manage.py migrate
python manage.py loaddata lessons_seed.json
```

### Frontend on Vercel

1. Sign in to [vercel.com](https://vercel.com) with GitHub
2. **New Project** → import this repo, set root directory to `frontend`
3. Build command `npm run build`, output `dist`
4. Add one variable:

```env
VITE_API_URL=https://your-app.up.railway.app
```

1. Deploy — you'll get a live URL on `.vercel.app`

---

## More details

- [backend/README.md](backend/README.md) — Django API setup, endpoints, notes
- [frontend/README.md](frontend/README.md) — React app scripts, offline behavior
