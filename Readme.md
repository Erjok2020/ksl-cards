# Kenya Sign Language Cards (KSL-CARDS)

**Live demo:**
Initial Product Demo: [https://docs.google.com/document/d/1HN1VNzTvPsMTpQ-wowZ6-5_mwL72DBptYX8EEydbrdk/edit?usp=sharing]
Final Product Demo : [https://drive.google.com/file/d/1m2F7uvwGJEcMM3wbaxyQ6vuLSil7g9wb/view?usp=drive_link]



KSL Cards is a lightweight, offline-capable web application for learning Kenya Sign Language, designed specifically for low-resource environments like Kakuma Refugee camp in Kenya

Users go through lessons, flip through cards, and progress gets saved as you go. Works offline — lessons stay cached on your device.

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

## Managing content through the admin

Django ships with a built-in admin site at `/admin/`, and it's already set up to manage everything in this app without touching code.

First, give yourself an account:

```bash
python manage.py createsuperuser
```

Log in at `/admin/` and you'll see:

- **Lessons** — add or edit lessons, and add the cards that belong to them right on the same page (no need to jump between screens)
- **Ksl cards** — every card across all lessons, searchable by meaning or description, filterable by lesson or category
- **Progress** — who's completed which lesson and when, filterable by completion status or lesson, searchable by username
- **Users** — manage accounts, including handing out staff access

To give someone limited access (so they can manage lessons but not, say, delete other users), open their account under **Users**, check **Staff status**, then either tick specific permissions or add them to a **Group** with the permissions you want pre-bundled.

---

## Running the frontend

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


## Recommendations
 both for the community and for future development.

For the community:

For schools, NGOs, and organizations working with the deaf community in Kenya. this platform is ready to use today. It requires no installation, no ongoing cost for the learner, and it works in areas with unreliable internet. A teacher can load lessons onto devices before class and students can work through them offline during the session.

We recommend partnering with KSL experts or the Kenya National Association of the Deaf to expand and verify the content. The technical platform is in place, what it needs now is more high-quality KSL material.

For future development:

The single highest impact improvement is video demonstrations per card. Seeing a sign performed is far more effective than reading a description. The data model already supports it — it would be an addition to what's already there.

quiz mode: Right now we know a user viewed the cards. We don't know if they retained anything. A simple test at the end of each lesson would turn this into a complete learning system.

converting to a full Progressive Web App with a service worker. This would allow the app to be installed on a phone like a native app, cache more aggressively, and eventually support full offline access even on first load.

content expansion: more lessons, more categories, coverage of regional KSL variations.
The goal we set out to achieve was simple: build something that works for learners who can't count on always being connected.

We built it. It's live, it's tested, and it works.
