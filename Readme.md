# Kenya Sign Language Cards (KSL-CARDS)

**Live demo:**
Initial Product Demo: [https://docs.google.com/document/d/1HN1VNzTvPsMTpQ-wowZ6-5_mwL72DBptYX8EEydbrdk/edit?usp=sharing]
Final Product Demo : [https://drive.google.com/file/d/1m2F7uvwGJEcMM3wbaxyQ6vuLSil7g9wb/view?usp=drive_link]

KSL Cards is an offline-capable web platform for learning Kenyan Sign Language (KSL), designed for D/HoH refugee learners in low-resource settings like Kakuma Refugee Camp in Kenya.

Each card shows a short KSL sign video with replay and slow-motion controls, the English word, a context sentence and a written movement description. Lessons are grouped into modules, and a learner can download a whole module to use with no internet. Progress is saved on the device and syncs, without duplicates, when the connection comes back.

Built with **React + TypeScript + Tailwind CSS** (a Progressive Web App with a Workbox service worker), **Django REST Framework** with JWT auth, **MySQL**, and **Docker**.

> **Sample clips are placeholders.** The videos in `backend/media/samples/` are generated placeholders that show the word on screen. They are **not KSL signs** and were never reviewed. The app labels every one of them "Sample clip — not a reviewed KSL sign". Replace them with recordings approved by a Deaf KSL reviewer before any evaluation.

---

## Running it with Docker (MySQL)

```bash
docker compose up --build
```

Open **<http://localhost:8080>**. This starts MySQL, the API (behind nginx at `/api`) and the PWA. The three sample modules are loaded on first start.

Create an administrator account:

```bash
docker compose exec backend python manage.py createsuperuser
```

For anything beyond local testing, set `DJANGO_SECRET_KEY`, `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD` in a `.env` file next to `docker-compose.yml`. Set `SEED_SAMPLE_LESSONS=false` once reviewed recordings are uploaded.

---

## Running it locally without Docker

You'll need Python 3.10+ and Node.js 20+.

**Backend:**

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_lessons     # 3 modules, 18 signs, placeholder clips
python manage.py seed_content     # starter FAQ + draft privacy policy (never overwrites edits)
python manage.py createsuperuser  # gets the Administrator role
DJANGO_DEBUG=true python manage.py runserver
```

That gets you the API at `http://127.0.0.1:8000`. It uses SQLite by default. To use MySQL, put a `.env`-style set of variables in your environment (see `backend/.env.example`) with `DJANGO_DB_ENGINE=mysql`.

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and talks to the API at `VITE_API_URL` (`frontend/.env.development`).

**Tests:**

```bash
cd backend && python manage.py test api
cd frontend && npm run typecheck && npm run lint
```

---

## Roles

Every account has one role. Roles are kept separate so the person who films a sign never approves it, and content uploaders can't manage users.

| Role | Can do |
| --- | --- |
| **Learner** (default for new accounts) | Browse lessons, watch signs, download modules, track progress |
| **Teacher** | Everything a learner can, plus create lessons and upload sign videos (they stay hidden until approved) |
| **Deaf KSL reviewer** | Review uploaded signs: approve, request a re-recording, or reject (with notes). Can't review their own uploads |
| **Administrator** | Manage users and assign roles, upload content. `createsuperuser` accounts are administrators |

Teachers, reviewers and administrators get a **Manage content** / **Review signs** tab in the app. An administrator assigns roles from **Users & roles**. Every review decision is stored as a `SignReview`, which gives an audit trail of who approved what and when. Only approved signs are ever shown to learners.

### Passwords

The app stores no email address or phone number, so there is no "email me a reset link".

- **Change password:** any signed-in user can do this from the **Account** tab (needs the current password).
- **Forgotten password:** an administrator opens **Manage content → Users & roles** and clicks **Reset password**. The app shows a temporary password once; the administrator gives it to the user in person, and the user must choose their own password at next sign-in.

The Django admin at `/admin/` is still available to superusers for lessons, cards, reviews, roles and progress.

---

## Pages

| URL | What it is |
| --- | --- |
| `/` | Course home (KSL Foundations): progress, modules, lessons and lesson checks |
| `/lesson/<id>` | Sign videos for one lesson (Space play/pause, R replay, S speed, arrow keys) |
| `/lesson/<id>/check` | Lesson check: watch a sign, pick the word. No timer |
| `/progress`, `/downloads`, `/account` | Progress and quiz scores, offline downloads, password |
| `/manage` | Teachers, reviewers and administrators |
| `/faq`, `/privacy`, `/feedback`, `/thank-you` | Work without signing in. FAQ and privacy text are edited in the Django admin |

The privacy policy is created as a **draft**. Review it with your supervisor and the ethics process, then untick "Is draft" in the admin.

### Lesson checks

Questions are generated in the app from the lesson's approved signs, so a newly approved sign joins the check automatically and the check works offline once the module is downloaded. A check is passed at 75% or more. Results queue on the device and sync to `POST /api/quiz-attempts/sync/` (idempotent on `client_event_id`); the server re-scores every answer. Administrators see all attempts, read-only, under **Quiz attempts** in the Django admin, for the learning-outcome evaluation.

## How offline works

- **App shell:** the service worker precaches the app on first load, so it opens with no network.
- **Lesson text:** fetched fresh when online, served from the last saved copy when offline.
- **Videos:** only saved when a learner taps **Download for offline** on a module, because video files are large. The dashboard shows each module's download size, whether it's available offline, storage used, and a **Remove download** button. If the browser clears storage, the module is flagged.
- **Progress:** every update becomes an event with a unique `client_event_id`, stored in IndexedDB first, then sent to `POST /api/progress/sync/`. The server ignores ids it has already seen, so re-sending a queue never creates duplicates. Progress only moves forward.
- **Auth:** JWT. Downloaded content needs no token. When a learner comes back online, an expired access token is refreshed automatically (refresh tokens last 30 days).

---

## API overview

| Endpoint | Who | What |
|---| --- | --- |
| `POST /api/register/`, `POST /api/login/` | anyone | Returns `access`, `refresh` and the user with role |
| `POST /api/token/refresh/` | anyone | New access token |
| `POST /api/password/change/` | signed in | Change your own password |
| `GET /api/lessons/` | signed in | Lessons with approved signs, module, card count, download size |
| `GET /api/lessons/<id>/cards/` | signed in | Approved cards only |
| `POST /api/progress/sync/` | signed in | Batch of progress events, de-duplicated by `client_event_id` |
| `GET /api/progress/me/` | signed in | Your progress |
| `GET/POST /api/manage/lessons/` | teacher, admin | List / create lessons |
| `GET/POST /api/manage/cards/`, `DELETE /api/manage/cards/<id>/` | teacher, admin | Upload sign videos (MP4/WebM, max 25 MB) |
| `GET /api/reviews/pending/`, `POST /api/cards/<id>/review/` | reviewer | Review queue and decisions |
| `GET /api/users/`, `PATCH /api/users/<id>/` | admin | Users and roles |
| `POST /api/users/<id>/reset-password/` | admin | Set a temporary password for a user |
| `GET /media/...` | anyone | Sign videos and posters (supports Range requests) |
| `GET /api/faq/`, `GET /api/pages/<slug>/` | anyone | FAQ entries and policy pages |
| `POST /api/feedback/` | anyone | Feedback; anonymous unless the sender opts in; 5 per hour |
| `GET /api/quiz-attempts/`, `POST /api/quiz-attempts/sync/` | signed in | Your lesson check results |
| `PATCH /api/manage/cards/<id>/` | teacher, admin | Replace a video or fix text; sends the sign back to review |

---

## Accessing the live app

The app is deployed at **[ksl-cards.vercel.app](https://ksl-cards.vercel.app)**, with the admin panel at **[ksl-cards-production.up.railway.app/admin](https://ksl-cards-production.up.railway.app/admin)**.

## How it's deployed

- **Backend** — hosted on [Railway](https://railway.app) with a MySQL database. After deploying this version, run `python manage.py migrate` and `python manage.py seed_lessons` once.
- **Frontend** — hosted on [Vercel](https://vercel.com), automatically redeploys when you push to `main`
- **Source code** — [github.com/Erjok2020/ksl-cards](https://github.com/Erjok2020/ksl-cards)

---

## Recommendations

For the community:

For schools, NGOs, and organizations working with the deaf community in Kenya, the platform needs no installation and no ongoing cost for the learner, and it works where the internet is unreliable. A teacher can download modules onto devices before class and students can work through them offline.

We recommend partnering with KSL experts or the Kenya National Association of the Deaf to record and verify the content. The review workflow is in place; what it needs now is real, reviewed KSL recordings to replace the sample clips.

For future development:

- **Quiz mode:** we know a learner viewed the cards, not whether they retained them. A short check at the end of each lesson would close that gap.
- **Sign variants:** each card holds one sign. KSL varies by region, so supporting several variants per concept is the next data-model change.
- **Content expansion:** more lessons and categories, chosen with Deaf stakeholders.
