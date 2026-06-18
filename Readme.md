# KSL Cards

**Live demo:** [ksl-cards.vercel.app](https://ksl-cards.vercel.app)

A simple app for learning Kenya Sign Language. Go through lessons, flip through cards, and your progress gets saved as you go. Works offline too — lessons stay cached on your device.

Built with Django on the backend and React + TypeScript on the frontend.

---

## Running it locally

You'll need Python 3.10+ and Node.js 18+ installed.

**Backend:**

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Backend runs at `http://127.0.0.1:8000`, frontend at `http://localhost:5173`.

---

## Accessing the live app

The app is deployed and live at **[ksl-cards.vercel.app](https://ksl-cards.vercel.app)**.

Just open that link in your browser — no login needed to browse, but you'll need to register an account to open lessons and track your progress.

The admin panel is at **[ksl-cards-production.up.railway.app/admin](https://ksl-cards-production.up.railway.app/admin)** — only staff accounts can log in there.

---

## How it's deployed

- **Backend** — hosted on [Railway](https://railway.app) with a MySQL database
- **Frontend** — hosted on [Vercel](https://vercel.com), automatically redeploys when you push to `main`
- **Source code** — [github.com/Erjok2020/ksl-cards](https://github.com/Erjok2020/ksl-cards)

---

## Managing content

The app has a built-in admin panel at `/admin/`. Log in with your superuser account and you can:

- Add or edit lessons and their cards from the same page
- Search and filter cards by meaning or category
- See who's completed which lesson under **Progress**
- Manage user accounts and staff access under **Users**

To create a superuser account:

```bash
python manage.py createsuperuser
```
