# Kenya Sign Language Cards (KSL-CARDS)

**Live demo:** [https://docs.google.com/document/d/1HN1VNzTvPsMTpQ-wowZ6-5_mwL72DBptYX8EEydbrdk/edit?usp=sharing

](https://ksl-cards.vercel.app)

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