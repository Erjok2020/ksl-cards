# KSL Cards Draft Version

# Setup and Run Instructions

## What is this?

This is the first working version of KSL Cards — an offline-capable
digital learning platform for Kenya Sign Language.

It has three screens:

1. Login / Register
2. Dashboard (lesson categories)
3. Card Viewer (flashcards with flip interaction)

---

## How to run the backend

# 1. Make sure you have Python 3.10+ installed

# 2. Install dependencies

pip install django djangorestframework

# 3. Set up the database

# Open MySQL and run:

mysql -u root -p < backend/schema.sql

# 4. Configure database connection in settings.py:

DATABASES = {
'default': {
'ENGINE': 'django.db.backends.mysql',
'NAME': 'ksl_cards_db',
'USER': 'root',
'PASSWORD': 'your_password',
'HOST': 'localhost',
'PORT': '3306',
}
}

# 5. Run migrations

python manage.py migrate

# 6. Start the server

python manage.py runserver

# Backend will run at: http://localhost:8000

---

## How to run the frontend

# 1. Make sure you have Node.js installed

# 2. Create a new Vite React project and copy the files

npm create vite@latest ksl-frontend -- --template react
cd ksl-frontend
npm install

# 3. Copy the files from frontend/src/ into your src/ folder

# 4. Start the dev server

npm run dev

# Frontend will run at: http://localhost:5173

---

## API Endpoints

POST /api/register/ create account
POST /api/login/ log in, get token
GET /api/lessons/ list all lessons
GET /api/lessons/:id/cards/ get cards for a lesson
POST /api/progress/ save lesson completion
GET /api/progress/me/ get user's progress

---

## What works offline

- After first load, lessons are cached in localStorage
- Card viewer works with or without internet
- Progress is saved locally if offline and can be synced later

---

## What is coming next (not in this version)

- Teacher upload interface
- Admin panel
- Image uploads for sign photos
- Progress analytics dashboard
- Full service worker / PWA setup
