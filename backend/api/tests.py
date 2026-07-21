from django.test import TestCase

from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token
from .models import Lesson, KSLCard, Progress


class RegistrationTest(TestCase):

    def test_register_new_user(self):
        client = APIClient()
        res = client.post("/api/register/", {"username": "testuser", "password": "pass1234"})
        self.assertEqual(res.status_code, 201)
        self.assertIn("token", res.data)

    def test_register_duplicate_username(self):
        User.objects.create_user(username="testuser", password="pass1234")
        client = APIClient()
        res = client.post("/api/register/", {"username": "testuser", "password": "pass1234"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.data)

    def test_register_missing_fields(self):
        client = APIClient()
        res = client.post("/api/register/", {"username": "", "password": ""})
        self.assertEqual(res.status_code, 400)


class LoginTest(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="pass1234")

    def test_login_correct_credentials(self):
        client = APIClient()
        res = client.post("/api/login/", {"username": "testuser", "password": "pass1234"})
        self.assertEqual(res.status_code, 200)
        self.assertIn("token", res.data)

    def test_login_wrong_password(self):
        client = APIClient()
        res = client.post("/api/login/", {"username": "testuser", "password": "wrongpass"})
        self.assertEqual(res.status_code, 401)

    def test_login_unauthenticated_cannot_access_lessons(self):
        client = APIClient()
        res = client.get("/api/lessons/")
        self.assertEqual(res.status_code, 401)


class LessonTest(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="pass1234")
        self.token = Token.objects.create(user=self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION="Token " + self.token.key)

        self.lesson = Lesson.objects.create(
            title="Greetings", category="Basic", description="Common greetings in KSL"
        )
        KSLCard.objects.create(
            lesson=self.lesson, meaning="Hello",
            description="Wave open hand at shoulder height.", order=1
        )
        KSLCard.objects.create(
            lesson=self.lesson, meaning="Thank You",
            description="Flat hand moves forward from chin.", order=2
        )

    def test_authenticated_user_can_fetch_lessons(self):
        res = self.client.get("/api/lessons/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["title"], "Greetings")

    def test_lesson_returns_correct_card_count(self):
        res = self.client.get("/api/lessons/")
        self.assertEqual(res.data[0]["card_count"], 2)

    def test_fetch_cards_for_lesson(self):
        res = self.client.get(f"/api/lessons/{self.lesson.id}/cards/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 2)
        self.assertEqual(res.data[0]["meaning"], "Hello")

    def test_fetch_cards_for_nonexistent_lesson(self):
        res = self.client.get("/api/lessons/9999/cards/")
        self.assertEqual(res.status_code, 404)


class ProgressTest(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="pass1234")
        self.token = Token.objects.create(user=self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION="Token " + self.token.key)

        self.lesson = Lesson.objects.create(
            title="Greetings", category="Basic", description="Common greetings"
        )
        KSLCard.objects.create(
            lesson=self.lesson, meaning="Hello",
            description="Wave open hand.", order=1
        )

    def test_save_progress_in_progress(self):
        res = self.client.post("/api/progress/", {
            "lesson_id": self.lesson.id,
            "completion": "in_progress"
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["completion"], "in_progress")

    def test_save_progress_completed(self):
        res = self.client.post("/api/progress/", {
            "lesson_id": self.lesson.id,
            "completion": "completed"
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["completion"], "completed")

    def test_progress_updates_on_second_save(self):
        self.client.post("/api/progress/", {
            "lesson_id": self.lesson.id, "completion": "in_progress"
        })
        res = self.client.post("/api/progress/", {
            "lesson_id": self.lesson.id, "completion": "completed"
        })
        self.assertEqual(res.data["completion"], "completed")
        self.assertEqual(Progress.objects.filter(user=self.user).count(), 1)

    def test_fetch_user_progress(self):
        self.client.post("/api/progress/", {
            "lesson_id": self.lesson.id, "completion": "completed"
        })
        res = self.client.get("/api/progress/me/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data[0]["completion"], "completed")
        self.assertEqual(res.data[0]["lesson"], "Greetings")


