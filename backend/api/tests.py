import shutil
import tempfile
import uuid

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .models import KSLCard, Lesson, Progress, ProgressEvent, Role, SignReview, UserProfile

TEMP_MEDIA = tempfile.mkdtemp()


def client_for(user):
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def make_user(username, role=Role.LEARNER):
    user = User.objects.create_user(username=username, password="pass1234")
    UserProfile.objects.filter(user=user).update(role=role)
    user.refresh_from_db()
    return user


class AuthTest(TestCase):
    def test_register_returns_jwt_pair_and_learner_role(self):
        res = APIClient().post("/api/register/", {"username": "amina", "password": "pass1234"})
        self.assertEqual(res.status_code, 201)
        self.assertIn("access", res.data)
        self.assertIn("refresh", res.data)
        self.assertEqual(res.data["user"]["role"], "learner")

    def test_register_duplicate_username(self):
        User.objects.create_user(username="amina", password="pass1234")
        res = APIClient().post("/api/register/", {"username": "Amina", "password": "pass1234"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("different one", res.data["error"])

    def test_register_missing_fields(self):
        res = APIClient().post("/api/register/", {"username": "", "password": ""})
        self.assertEqual(res.status_code, 400)

    def test_password_is_hashed(self):
        APIClient().post("/api/register/", {"username": "amina", "password": "pass1234"})
        user = User.objects.get(username="amina")
        self.assertNotEqual(user.password, "pass1234")
        self.assertTrue(user.password.startswith("pbkdf2_sha256$"))

    def test_login_and_refresh(self):
        User.objects.create_user(username="amina", password="pass1234")
        res = APIClient().post("/api/login/", {"username": "amina", "password": "pass1234"})
        self.assertEqual(res.status_code, 200)
        refreshed = APIClient().post("/api/token/refresh/", {"refresh": res.data["refresh"]})
        self.assertEqual(refreshed.status_code, 200)
        self.assertIn("access", refreshed.data)

    def test_login_wrong_password(self):
        User.objects.create_user(username="amina", password="pass1234")
        res = APIClient().post("/api/login/", {"username": "amina", "password": "nope"})
        self.assertEqual(res.status_code, 401)

    def test_lessons_require_auth(self):
        self.assertEqual(APIClient().get("/api/lessons/").status_code, 401)

    def test_superuser_gets_admin_role(self):
        admin = User.objects.create_superuser(username="root", password="pass1234")
        res = client_for(admin).get("/api/me/")
        self.assertEqual(res.data["role"], "admin")


class LessonTest(TestCase):
    def setUp(self):
        self.client = client_for(make_user("learner"))
        self.lesson = Lesson.objects.create(
            title="Greetings", module="Module 1", category="basics", description="Common greetings"
        )
        KSLCard.objects.create(
            lesson=self.lesson, english_word="Hello", context_sentence="Hello, friend.",
            review_status="approved", order=1,
        )
        KSLCard.objects.create(
            lesson=self.lesson, english_word="Thank You", review_status="approved", order=2
        )
        KSLCard.objects.create(lesson=self.lesson, english_word="Pending", order=3)
        KSLCard.objects.create(
            lesson=self.lesson, english_word="Rejected", review_status="rejected", order=4
        )

    def test_lesson_list_counts_only_approved_cards(self):
        res = self.client.get("/api/lessons/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["card_count"], 2)
        self.assertEqual(res.data[0]["module"], "Module 1")
        self.assertIn("download_size_kb", res.data[0])

    def test_lessons_without_approved_cards_are_hidden(self):
        Lesson.objects.create(title="Empty", category="x")
        res = self.client.get("/api/lessons/")
        self.assertEqual([l["title"] for l in res.data], ["Greetings"])

    def test_only_approved_cards_are_published(self):
        res = self.client.get(f"/api/lessons/{self.lesson.id}/cards/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual([c["english_word"] for c in res.data], ["Hello", "Thank You"])
        self.assertEqual(res.data[0]["context_sentence"], "Hello, friend.")

    def test_lessons_are_ordered_by_module(self):
        later = Lesson.objects.create(title="Aardvark", module="Module 2", category="x")
        KSLCard.objects.create(lesson=later, english_word="A", review_status="approved")
        res = self.client.get("/api/lessons/")
        self.assertEqual([l["module"] for l in res.data], ["Module 1", "Module 2"])

    def test_fetch_cards_for_nonexistent_lesson(self):
        self.assertEqual(self.client.get("/api/lessons/9999/cards/").status_code, 404)


class ProgressSyncTest(TestCase):
    def setUp(self):
        self.user = make_user("learner")
        self.client = client_for(self.user)
        self.lesson = Lesson.objects.create(title="Greetings", category="basics")
        for i in range(3):
            KSLCard.objects.create(
                lesson=self.lesson, english_word=f"w{i}", review_status="approved", order=i
            )

    def event(self, cards, completed=False, event_id=None):
        return {
            "client_event_id": str(event_id or uuid.uuid4()),
            "lesson_id": self.lesson.id,
            "completed_cards": cards,
            "completed": completed,
        }

    def test_single_progress_event(self):
        res = self.client.post("/api/progress/", self.event(1), format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "applied")
        self.assertEqual(res.data["completed_cards"], 1)

    def test_resending_same_event_creates_no_duplicates(self):
        events = [self.event(1), self.event(3, completed=True)]
        first = self.client.post("/api/progress/sync/", {"events": events}, format="json")
        again = self.client.post("/api/progress/sync/", {"events": events}, format="json")
        self.assertEqual(len(first.data["applied"]), 2)
        self.assertEqual(len(again.data["duplicates"]), 2)
        self.assertEqual(again.data["applied"], [])
        self.assertEqual(Progress.objects.filter(user=self.user).count(), 1)
        self.assertEqual(ProgressEvent.objects.count(), 2)

    def test_progress_never_moves_backwards(self):
        self.client.post("/api/progress/sync/", {"events": [self.event(3, completed=True)]}, format="json")
        res = self.client.post("/api/progress/sync/", {"events": [self.event(1)]}, format="json")
        record = res.data["progress"][0]
        self.assertEqual(record["completed_cards"], 3)
        self.assertTrue(record["completed"])

    def test_bad_events_are_rejected_not_fatal(self):
        events = [self.event(1), {"client_event_id": "not-a-uuid", "lesson_id": self.lesson.id}]
        res = self.client.post("/api/progress/sync/", {"events": events}, format="json")
        self.assertEqual(len(res.data["applied"]), 1)
        self.assertEqual(len(res.data["rejected"]), 1)

    def test_fetch_user_progress(self):
        self.client.post("/api/progress/", self.event(3, completed=True), format="json")
        res = self.client.get("/api/progress/me/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data[0]["lesson"], "Greetings")
        self.assertEqual(res.data[0]["card_count"], 3)
        self.assertTrue(res.data[0]["completed"])


@override_settings(MEDIA_ROOT=TEMP_MEDIA)
class ContentAndReviewTest(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA, ignore_errors=True)

    def setUp(self):
        self.teacher = make_user("teacher", Role.TEACHER)
        self.reviewer = make_user("reviewer", Role.REVIEWER)
        self.learner = make_user("learner")
        self.admin = make_user("admin", Role.ADMIN)
        self.lesson = Lesson.objects.create(title="Greetings", category="basics")

    def upload(self, client, word="Hello"):
        video = SimpleUploadedFile("hello.mp4", b"\x00" * 4096, content_type="video/mp4")
        return client.post(
            "/api/manage/cards/",
            {"lesson_id": self.lesson.id, "english_word": word, "video": video},
            format="multipart",
        )

    def test_teacher_upload_is_pending_and_hidden_from_learners(self):
        res = self.upload(client_for(self.teacher))
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["review_status"], "pending")
        self.assertEqual(res.data["file_size_kb"], 4)
        cards = client_for(self.learner).get(f"/api/lessons/{self.lesson.id}/cards/")
        self.assertEqual(cards.data, [])

    def test_upload_list_shows_pending_first(self):
        KSLCard.objects.create(lesson=self.lesson, english_word="Old sample", review_status="approved", is_sample=True)
        self.upload(client_for(self.teacher), word="New upload")
        res = client_for(self.admin).get("/api/manage/cards/")
        self.assertEqual(res.data[0]["english_word"], "New upload")
        self.assertEqual(res.data[0]["review_status"], "pending")

    def test_learner_cannot_upload(self):
        self.assertEqual(self.upload(client_for(self.learner)).status_code, 403)

    def test_rejects_non_video_upload(self):
        bad = SimpleUploadedFile("x.txt", b"hi", content_type="text/plain")
        res = client_for(self.teacher).post(
            "/api/manage/cards/",
            {"lesson_id": self.lesson.id, "english_word": "Hi", "video": bad},
            format="multipart",
        )
        self.assertEqual(res.status_code, 400)

    def test_reviewer_approval_publishes_card_with_audit_trail(self):
        card_id = self.upload(client_for(self.teacher)).data["id"]
        reviewer = client_for(self.reviewer)
        self.assertEqual(len(reviewer.get("/api/reviews/pending/").data), 1)
        res = reviewer.post(f"/api/cards/{card_id}/review/", {"decision": "approved"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["review_status"], "approved")
        self.assertEqual(SignReview.objects.filter(card_id=card_id).count(), 1)
        cards = client_for(self.learner).get(f"/api/lessons/{self.lesson.id}/cards/")
        self.assertEqual(len(cards.data), 1)

    def test_revise_keeps_card_pending_and_requires_notes(self):
        card_id = self.upload(client_for(self.teacher)).data["id"]
        reviewer = client_for(self.reviewer)
        no_notes = reviewer.post(f"/api/cards/{card_id}/review/", {"decision": "revise"}, format="json")
        self.assertEqual(no_notes.status_code, 400)
        res = reviewer.post(
            f"/api/cards/{card_id}/review/",
            {"decision": "revise", "notes": "Handshape unclear"},
            format="json",
        )
        self.assertEqual(res.data["review_status"], "pending")

    def test_reviewer_cannot_review_own_upload(self):
        card = KSLCard.objects.create(lesson=self.lesson, english_word="X", uploaded_by=self.reviewer)
        res = client_for(self.reviewer).post(
            f"/api/cards/{card.id}/review/", {"decision": "approved"}, format="json"
        )
        self.assertEqual(res.status_code, 403)

    def test_teacher_cannot_review_or_manage_users(self):
        teacher = client_for(self.teacher)
        self.assertEqual(teacher.get("/api/reviews/pending/").status_code, 403)
        self.assertEqual(teacher.get("/api/users/").status_code, 403)

    def test_admin_assigns_roles(self):
        res = client_for(self.admin).patch(
            f"/api/users/{self.learner.id}/", {"role": "reviewer"}, format="json"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["role"], "reviewer")

    def test_admin_cannot_demote_self(self):
        res = client_for(self.admin).patch(
            f"/api/users/{self.admin.id}/", {"role": "learner"}, format="json"
        )
        self.assertEqual(res.status_code, 400)

    def test_teacher_creates_lesson(self):
        res = client_for(self.teacher).post(
            "/api/manage/lessons/",
            {"title": "Colours", "category": "basics", "module": "Module 4"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["module"], "Module 4")


@override_settings(MEDIA_ROOT=TEMP_MEDIA)
class MediaRangeTest(TestCase):
    def setUp(self):
        import os

        os.makedirs(f"{TEMP_MEDIA}/signs", exist_ok=True)
        with open(f"{TEMP_MEDIA}/signs/clip.mp4", "wb") as f:
            f.write(bytes(range(100)))

    def test_full_and_range_requests(self):
        full = self.client.get("/media/signs/clip.mp4")
        self.assertEqual(full.status_code, 200)
        self.assertEqual(full["Accept-Ranges"], "bytes")
        part = self.client.get("/media/signs/clip.mp4", HTTP_RANGE="bytes=10-19")
        self.assertEqual(part.status_code, 206)
        self.assertEqual(part["Content-Range"], "bytes 10-19/100")
        self.assertEqual(b"".join(part.streaming_content), bytes(range(10, 20)))

    def test_path_traversal_is_blocked(self):
        self.assertEqual(self.client.get("/media/../manage.py").status_code, 404)


class PasswordTest(TestCase):
    def setUp(self):
        self.learner = make_user("learner")
        self.admin = make_user("admin", Role.ADMIN)
        self.teacher = make_user("teacher", Role.TEACHER)

    def test_user_changes_own_password(self):
        res = client_for(self.learner).post(
            "/api/password/change/",
            {"current_password": "pass1234", "new_password": "brand-new-1"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.data)
        login = APIClient().post("/api/login/", {"username": "learner", "password": "brand-new-1"})
        self.assertEqual(login.status_code, 200)
        old = APIClient().post("/api/login/", {"username": "learner", "password": "pass1234"})
        self.assertEqual(old.status_code, 401)

    def test_change_requires_correct_current_password(self):
        res = client_for(self.learner).post(
            "/api/password/change/",
            {"current_password": "wrong", "new_password": "brand-new-1"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_change_rejects_short_or_same_password(self):
        client = client_for(self.learner)
        short = client.post(
            "/api/password/change/", {"current_password": "pass1234", "new_password": "abc"}, format="json"
        )
        same = client.post(
            "/api/password/change/", {"current_password": "pass1234", "new_password": "pass1234"}, format="json"
        )
        self.assertEqual(short.status_code, 400)
        self.assertEqual(same.status_code, 400)

    def test_admin_reset_gives_temporary_password_and_forces_change(self):
        res = client_for(self.admin).post(f"/api/users/{self.learner.id}/reset-password/")
        self.assertEqual(res.status_code, 200)
        temp = res.data["temporary_password"]
        self.assertEqual(len(temp), 8)
        login = APIClient().post("/api/login/", {"username": "learner", "password": temp})
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.data["user"]["must_change_password"])
        # Choosing a new password clears the flag.
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        changed = client.post(
            "/api/password/change/", {"current_password": temp, "new_password": "my-own-pass"}, format="json"
        )
        self.assertFalse(changed.data["user"]["must_change_password"])

    def test_only_admin_can_reset(self):
        res = client_for(self.teacher).post(f"/api/users/{self.learner.id}/reset-password/")
        self.assertEqual(res.status_code, 403)
        self.assertTrue(User.objects.get(id=self.learner.id).check_password("pass1234"))

    def test_admin_cannot_reset_own_password_this_way(self):
        res = client_for(self.admin).post(f"/api/users/{self.admin.id}/reset-password/")
        self.assertEqual(res.status_code, 400)


from django.core.cache import cache
from django.core.management import call_command

from .models import FAQEntry, Feedback, PolicyPage, QuizAttempt


class ContentPagesTest(TestCase):
    def test_faq_is_public_grouped_and_hides_unpublished(self):
        FAQEntry.objects.create(category="offline", question="Q offline", answer="A", order=1)
        FAQEntry.objects.create(category="learning", question="Q learning", answer="A", order=1, slug="signers")
        FAQEntry.objects.create(category="account", question="Hidden", answer="A", is_published=False)
        res = APIClient().get("/api/faq/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual([e["question"] for e in res.data], ["Q learning", "Q offline"])
        self.assertEqual(res.data[0]["slug"], "signers")
        self.assertEqual(res.data[0]["category_label"], "Learning")

    def test_faq_and_pages_are_read_only(self):
        self.assertEqual(APIClient().post("/api/faq/", {}).status_code, 405)
        self.assertEqual(APIClient().post("/api/pages/privacy/", {}).status_code, 405)

    def test_policy_page(self):
        PolicyPage.objects.create(slug="privacy", title="Privacy policy", body="## What we collect\n- x")
        res = APIClient().get("/api/pages/privacy/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["is_draft"])
        self.assertEqual(APIClient().get("/api/pages/nope/").status_code, 404)

    def test_seed_content_is_idempotent_and_keeps_edits(self):
        call_command("seed_content", verbosity=0)
        count = FAQEntry.objects.count()
        self.assertGreater(count, 5)
        self.assertTrue(FAQEntry.objects.filter(slug="lesson-check").exists())
        PolicyPage.objects.filter(slug="privacy").update(body="edited")
        call_command("seed_content", verbosity=0)
        self.assertEqual(FAQEntry.objects.count(), count)
        self.assertEqual(PolicyPage.objects.get(slug="privacy").body, "edited")


class FeedbackTest(TestCase):
    def setUp(self):
        cache.clear()
        self.user = make_user("learner")

    def test_anonymous_feedback_allowed(self):
        res = APIClient().post("/api/feedback/", {"message": "Video 3 is dark", "page": "/lesson/4"}, format="json")
        self.assertEqual(res.status_code, 201)
        fb = Feedback.objects.get()
        self.assertIsNone(fb.user)
        self.assertEqual(fb.status, "new")
        self.assertEqual(fb.page, "/lesson/4")

    def test_signed_in_feedback_is_anonymous_unless_asked(self):
        client = client_for(self.user)
        client.post("/api/feedback/", {"message": "one", "rating": 4}, format="json")
        client.post("/api/feedback/", {"message": "two", "include_username": True}, format="json")
        self.assertIsNone(Feedback.objects.get(message="one").user)
        self.assertEqual(Feedback.objects.get(message="one").rating, 4)
        self.assertEqual(Feedback.objects.get(message="two").user, self.user)

    def test_feedback_validation(self):
        client = APIClient()
        self.assertEqual(client.post("/api/feedback/", {"message": "  "}, format="json").status_code, 400)
        self.assertEqual(client.post("/api/feedback/", {"message": "x", "rating": 9}, format="json").status_code, 400)
        self.assertEqual(client.post("/api/feedback/", {"message": "x" * 2001}, format="json").status_code, 400)

    def test_feedback_is_rate_limited(self):
        client = APIClient()
        codes = [client.post("/api/feedback/", {"message": f"m{i}"}, format="json").status_code for i in range(6)]
        self.assertEqual(codes[:5], [201] * 5)
        self.assertEqual(codes[5], 429)
        self.assertEqual(Feedback.objects.count(), 5)


class QuizAttemptTest(TestCase):
    def setUp(self):
        self.user = make_user("learner")
        self.other = make_user("other")
        self.lesson = Lesson.objects.create(title="Greetings", category="basics")
        self.cards = [
            KSLCard.objects.create(lesson=self.lesson, english_word=w, review_status="approved", order=i)
            for i, w in enumerate(["Hello", "Goodbye"])
        ]

    def attempt(self, chosen=None, event_id=None):
        a, b = self.cards
        chosen = chosen or [a.id, a.id]  # first right, second wrong
        return {
            "client_event_id": str(event_id or uuid.uuid4()),
            "lesson_id": self.lesson.id,
            "answers": [
                {"card_id": a.id, "chosen_card_id": chosen[0], "correct": True},
                {"card_id": b.id, "chosen_card_id": chosen[1], "correct": True},  # client lies
            ],
        }

    def test_requires_authentication(self):
        self.assertEqual(APIClient().get("/api/quiz-attempts/").status_code, 401)
        res = APIClient().post("/api/quiz-attempts/sync/", {"attempts": [self.attempt()]}, format="json")
        self.assertEqual(res.status_code, 401)

    def test_two_card_lesson_attempt_and_server_side_scoring(self):
        res = client_for(self.user).post("/api/quiz-attempts/sync/", {"attempts": [self.attempt()]}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["applied"]), 1)
        saved = QuizAttempt.objects.get()
        self.assertEqual((saved.score, saved.total), (1, 2))  # not the 2 the client claimed
        self.assertEqual([a["correct"] for a in saved.answers], [True, False])

    def test_sync_is_idempotent(self):
        client = client_for(self.user)
        attempt = self.attempt()
        first = client.post("/api/quiz-attempts/sync/", {"attempts": [attempt]}, format="json")
        again = client.post("/api/quiz-attempts/sync/", {"attempts": [attempt]}, format="json")
        self.assertEqual(len(first.data["applied"]), 1)
        self.assertEqual(again.data["applied"], [])
        self.assertEqual(len(again.data["duplicates"]), 1)
        self.assertEqual(QuizAttempt.objects.count(), 1)

    def test_users_only_see_their_own_attempts(self):
        client_for(self.user).post("/api/quiz-attempts/sync/", {"attempts": [self.attempt()]}, format="json")
        client_for(self.other).post("/api/quiz-attempts/sync/", {"attempts": [self.attempt()]}, format="json")
        mine = client_for(self.user).get("/api/quiz-attempts/")
        self.assertEqual(len(mine.data), 1)
        self.assertEqual(mine.data[0]["lesson"], "Greetings")
        self.assertEqual(QuizAttempt.objects.filter(user=self.other).count(), 1)

    def test_answers_must_belong_to_the_lesson(self):
        stray = KSLCard.objects.create(
            lesson=Lesson.objects.create(title="Other", category="x"), english_word="X", review_status="approved"
        )
        bad = self.attempt(chosen=[stray.id, stray.id])
        res = client_for(self.user).post("/api/quiz-attempts/sync/", {"attempts": [bad, {"nope": 1}]}, format="json")
        self.assertEqual(len(res.data["rejected"]), 2)
        self.assertEqual(QuizAttempt.objects.count(), 0)

    def test_progress_endpoints_are_untouched_by_quiz(self):
        client = client_for(self.user)
        client.post("/api/quiz-attempts/sync/", {"attempts": [self.attempt()]}, format="json")
        self.assertEqual(client.get("/api/progress/me/").data, [])


@override_settings(MEDIA_ROOT=TEMP_MEDIA)
class PortedFeaturesTest(TestCase):
    def setUp(self):
        self.teacher = make_user("teacher", Role.TEACHER)
        self.reviewer = make_user("reviewer", Role.REVIEWER)
        self.learner = make_user("learner")
        self.lesson = Lesson.objects.create(title="Greetings", category="basics")

    def video(self, name="a.mp4"):
        return SimpleUploadedFile(name, b"\x00" * 2048, content_type="video/mp4")

    def test_kiswahili_and_reviewed_flags(self):
        res = client_for(self.teacher).post(
            "/api/manage/cards/",
            {"lesson_id": self.lesson.id, "english_word": "Water", "kiswahili": "Maji", "video": self.video()},
            format="multipart",
        )
        card_id = res.data["id"]
        client_for(self.reviewer).post(f"/api/cards/{card_id}/review/", {"decision": "approved"}, format="json")
        sample = KSLCard.objects.create(
            lesson=self.lesson, english_word="Hello", review_status="approved", is_sample=True
        )
        cards = client_for(self.learner).get(f"/api/lessons/{self.lesson.id}/cards/").data
        by_id = {c["id"]: c for c in cards}
        self.assertEqual(by_id[card_id]["kiswahili"], "Maji")
        self.assertTrue(by_id[card_id]["reviewed"])
        self.assertFalse(by_id[sample.id]["reviewed"])  # sample clips are never "reviewed"
        lesson = client_for(self.learner).get("/api/lessons/").data[0]
        self.assertEqual((lesson["card_count"], lesson["reviewed_count"]), (2, 1))

    def test_replacing_video_sends_card_back_to_review(self):
        teacher = client_for(self.teacher)
        card_id = teacher.post(
            "/api/manage/cards/",
            {"lesson_id": self.lesson.id, "english_word": "Water", "video": self.video()},
            format="multipart",
        ).data["id"]
        client_for(self.reviewer).post(f"/api/cards/{card_id}/review/", {"decision": "approved"}, format="json")
        res = teacher.patch(f"/api/manage/cards/{card_id}/", {"video": self.video("b.mp4")}, format="multipart")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["review_status"], "pending")
        self.assertEqual(client_for(self.learner).get(f"/api/lessons/{self.lesson.id}/cards/").data, [])

    def test_teacher_cannot_replace_someone_elses_card(self):
        card = KSLCard.objects.create(lesson=self.lesson, english_word="X", uploaded_by=self.reviewer)
        res = client_for(self.teacher).patch(f"/api/manage/cards/{card.id}/", {"english_word": "Y"}, format="json")
        self.assertEqual(res.status_code, 403)

    def test_approval_needs_a_video(self):
        card = KSLCard.objects.create(lesson=self.lesson, english_word="No video", uploaded_by=self.teacher)
        res = client_for(self.reviewer).post(f"/api/cards/{card.id}/review/", {"decision": "approved"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(KSLCard.objects.get(id=card.id).review_status, "pending")

    def test_staff_can_preview_pending_but_learners_cannot(self):
        KSLCard.objects.create(lesson=self.lesson, english_word="Pending", uploaded_by=self.teacher)
        url = f"/api/lessons/{self.lesson.id}/cards/?include_pending=1"
        staff = client_for(self.teacher).get(url)
        self.assertEqual([c["review_status"] for c in staff.data], ["pending"])
        self.assertEqual(client_for(self.learner).get(url).data, [])


class SeedSampleFilesTest(TestCase):
    def test_samples_copied_to_separate_media_root(self):
        import os
        from django.core.management import call_command

        target = tempfile.mkdtemp()
        try:
            with override_settings(MEDIA_ROOT=target):
                call_command("seed_lessons", verbosity=0)
                self.assertTrue(os.path.exists(os.path.join(target, "samples", "hello.mp4")))
                card = KSLCard.objects.get(english_word="Hello")
                self.assertGreater(card.file_size_kb, 0)
                call_command("seed_lessons", verbosity=0)  # second run copies nothing new
            self.assertEqual(KSLCard.objects.filter(english_word="Hello").count(), 1)
        finally:
            shutil.rmtree(target, ignore_errors=True)


class DeploySafetyTest(TestCase):
    """Behaviour that keeps the live (Railway) deploy safe."""

    def setUp(self):
        self.client = client_for(make_user("learner"))
        self.lesson = Lesson.objects.create(title="Greetings", category="basics")

    def test_old_image_link_survives_as_poster(self):
        link = "https://example.org/images/" + "a" * 150 + ".png"  # longer than 100 characters
        card = KSLCard.objects.create(lesson=self.lesson, english_word="Hello", review_status="approved")
        card.poster.name = link
        card.save()  # must not raise
        card.refresh_from_db()
        self.assertEqual(card.poster.name, link)
        self.assertEqual(card.poster_size_kb, 0)
        data = self.client.get(f"/api/lessons/{self.lesson.id}/cards/").data
        self.assertEqual(data[0]["poster_url"], link)

    def test_samples_served_from_code_when_media_root_is_elsewhere(self):
        empty = tempfile.mkdtemp()
        try:
            with override_settings(MEDIA_ROOT=empty):
                res = self.client.get("/media/samples/hello.mp4", HTTP_RANGE="bytes=0-9")
                self.assertEqual(res.status_code, 206)
                self.assertEqual(self.client.get("/media/samples/../../manage.py").status_code, 404)
                self.assertEqual(self.client.get("/media/samples/missing.mp4").status_code, 404)
                card = KSLCard(lesson=self.lesson, english_word="Hello")
                card.video.name = "samples/hello.mp4"
                card.save()
                self.assertGreater(card.file_size_kb, 0)
        finally:
            shutil.rmtree(empty, ignore_errors=True)

    def test_seed_keeps_existing_poster(self):
        from django.core.management import call_command

        lesson = Lesson.objects.create(title="Family", category="people")
        card = KSLCard.objects.create(lesson=lesson, english_word="Mother")
        card.poster.name = "https://example.org/mother.png"
        card.save()
        call_command("seed_lessons", verbosity=0)
        card.refresh_from_db()
        self.assertEqual(card.poster.name, "https://example.org/mother.png")
        self.assertEqual(card.video.name, "samples/mother.mp4")


class SeedOnStartTest(TestCase):
    """seed_content/seed_lessons --if-new run on every server start."""

    def test_seed_content_if_new_keeps_deletions(self):
        from django.core.management import call_command

        call_command("seed_content", "--if-new", verbosity=0)
        total = FAQEntry.objects.count()
        self.assertGreater(total, 0)
        FAQEntry.objects.filter(slug="why-ksl").delete()
        call_command("seed_content", "--if-new", verbosity=0)
        self.assertEqual(FAQEntry.objects.count(), total - 1)

    def test_seed_lessons_if_new_runs_once(self):
        from django.core.management import call_command

        call_command("seed_lessons", "--if-new", verbosity=0)
        self.assertEqual(KSLCard.objects.filter(is_sample=True).count(), 18)
        KSLCard.objects.filter(english_word="Ten").delete()
        call_command("seed_lessons", "--if-new", verbosity=0)
        self.assertFalse(KSLCard.objects.filter(english_word="Ten").exists())
