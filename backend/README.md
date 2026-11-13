# KSL Cards Backend

The Django REST Framework API that powers KSL Cards.

## What it does

- Registration and sign-in with JWT access/refresh tokens
- Lessons grouped into modules, and KSL cards with sign video, poster, English word, context sentence and movement description
- A review workflow: teachers upload signs, a Deaf KSL reviewer approves, requests a re-recording or rejects them. Only approved cards reach learners, and every decision is kept as an audit trail (`SignReview`)
- Roles: learner, teacher, reviewer, administrator
- Progress tracking with offline sync that never creates duplicates (`client_event_id`)
- Serving sign videos with HTTP Range support (`api/media.py`)

## Run it locally

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_lessons
python manage.py createsuperuser
DJANGO_DEBUG=true python manage.py runserver 127.0.0.1:8000
python manage.py test api
```

`seed_lessons` creates three modules (Greetings, Numbers, Family; 18 signs) using **placeholder** clips from `media/samples/`. They are not KSL signs and are labelled as samples in the app. It is safe to run again and never overwrites a card that has a real recording.

## Data model

`Lesson` (title, module, category, sort_order) → `KSLCard` (english_word, context_sentence, movement_description, video, poster, file_size_kb, review_status, is_sample, uploaded_by) → `SignReview` (reviewer, decision, notes, reviewed_at). `UserProfile` holds each user's role. `Progress` (completed_cards, completed, client_event_id) is one row per learner and lesson; `ProgressEvent` records every accepted event id so re-sent events are ignored.

See the root [Readme.md](../Readme.md) for the full endpoint list and Docker setup.

## Notes

- SQLite is the default database. For MySQL set `DJANGO_DB_ENGINE=mysql` and the `DJANGO_DB_*` variables (see `.env.example`).
- Uploaded files go to `media/signs/` and `media/posters/` (git-ignored). Set `DJANGO_MEDIA_ROOT` to move them.
- Token lifetimes: `JWT_ACCESS_MINUTES` (default 60) and `JWT_REFRESH_DAYS` (default 30).
