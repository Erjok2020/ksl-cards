"""FAQ, policy pages, feedback and lesson-check (quiz) endpoints.

All additive: none of the existing lesson, review or progress endpoints
are changed by this module.
"""

import uuid
from datetime import datetime

from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from .models import FAQEntry, Feedback, KSLCard, Lesson, PolicyPage, QuizAttempt

MAX_FEEDBACK_CHARS = 2000
MAX_QUIZ_QUESTIONS = 100
MAX_ATTEMPTS_PER_SYNC = 200


def error(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({"error": message}, status=code)


# ---------- FAQ and policy pages (public, read-only) ----------

@api_view(["GET"])
@permission_classes([AllowAny])
def faq_list(request):
    entries = FAQEntry.objects.filter(is_published=True)
    order = {value: i for i, (value, _) in enumerate(FAQEntry.Category.choices)}
    entries = sorted(entries, key=lambda e: (order.get(e.category, 99), e.order, e.id))
    return Response(
        [
            {
                "id": e.id,
                "category": e.category,
                "category_label": e.get_category_display(),
                "question": e.question,
                "answer": e.answer,
                "slug": e.slug,
            }
            for e in entries
        ]
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def policy_page(request, slug):
    try:
        page = PolicyPage.objects.get(slug=slug)
    except PolicyPage.DoesNotExist:
        return error("Page not found.", status.HTTP_404_NOT_FOUND)
    return Response(
        {
            "slug": page.slug,
            "title": page.title,
            "body": page.body,
            "is_draft": page.is_draft,
            "updated_at": page.updated_at,
        }
    )


# ---------- Feedback ----------

class FeedbackThrottle(SimpleRateThrottle):
    """At most 5 feedback messages an hour per account, or per network
    address for people who are not signed in."""

    scope = "feedback"
    rate = "5/hour"

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = f"user-{request.user.pk}"
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([FeedbackThrottle])
def feedback_create(request):
    message = str(request.data.get("message", "")).strip()
    if not message:
        return error("Please write a message.")
    if len(message) > MAX_FEEDBACK_CHARS:
        return error(f"Please keep your message under {MAX_FEEDBACK_CHARS} characters.")

    rating = request.data.get("rating")
    if rating in ("", None):
        rating = None
    else:
        try:
            rating = int(rating)
        except (TypeError, ValueError):
            return error("Rating must be a number from 1 to 5.")
        if not 1 <= rating <= 5:
            return error("Rating must be a number from 1 to 5.")

    # Anonymous unless the sender is signed in AND asked to be identified.
    include_username = request.data.get("include_username") in (True, "true", "1", 1, "on")
    user = request.user if (include_username and request.user.is_authenticated) else None

    Feedback.objects.create(
        user=user,
        page=str(request.data.get("page", ""))[:200],
        rating=rating,
        message=message,
    )
    # Nothing about the message is echoed back.
    return Response({"status": "received"}, status=status.HTTP_201_CREATED)


# ---------- Lesson checks (quiz attempts) ----------

def attempt_payload(a):
    return {
        "client_event_id": str(a.client_event_id),
        "lesson_id": a.lesson_id,
        "lesson": a.lesson.title,
        "score": a.score,
        "total": a.total,
        "answers": a.answers,
        "completed_at": a.completed_at,
    }


def _clean_attempt(user, raw):
    """Validate one attempt. Returns (fields, None) or (None, error message)."""
    try:
        event_id = uuid.UUID(str(raw.get("client_event_id")))
    except (ValueError, TypeError):
        return None, "client_event_id must be a UUID."
    try:
        lesson = Lesson.objects.get(id=raw.get("lesson_id"))
    except (Lesson.DoesNotExist, ValueError, TypeError):
        return None, "Lesson not found."

    answers = raw.get("answers")
    if not isinstance(answers, list) or not 1 <= len(answers) <= MAX_QUIZ_QUESTIONS:
        return None, "answers must be a list with at least one answer."

    lesson_card_ids = set(KSLCard.objects.filter(lesson=lesson).values_list("id", flat=True))
    cleaned = []
    for answer in answers:
        if not isinstance(answer, dict):
            return None, "Each answer must be an object."
        try:
            card_id = int(answer.get("card_id"))
            chosen = int(answer.get("chosen_card_id"))
        except (TypeError, ValueError):
            return None, "Each answer needs card_id and chosen_card_id."
        if card_id not in lesson_card_ids or chosen not in lesson_card_ids:
            return None, "Answers must refer to signs in this lesson."
        # The server decides what counts as correct, not the client.
        cleaned.append({"card_id": card_id, "chosen_card_id": chosen, "correct": card_id == chosen})

    completed_at = parse_datetime(str(raw.get("completed_at") or ""))
    now = timezone.now()
    if not isinstance(completed_at, datetime):
        completed_at = now
    elif timezone.is_naive(completed_at):
        completed_at = timezone.make_aware(completed_at)
    completed_at = min(completed_at, now)

    return {
        "client_event_id": event_id,
        "user": user,
        "lesson": lesson,
        "score": sum(1 for a in cleaned if a["correct"]),
        "total": len(cleaned),
        "answers": cleaned,
        "completed_at": completed_at,
    }, None


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def quiz_attempts_sync(request):
    """Idempotent on client_event_id: an attempt sent twice is stored once."""
    attempts = request.data.get("attempts")
    if not isinstance(attempts, list):
        return error("attempts must be a list.")
    if len(attempts) > MAX_ATTEMPTS_PER_SYNC:
        return error(f"Send at most {MAX_ATTEMPTS_PER_SYNC} attempts at a time.")

    applied, duplicates, rejected = [], [], []
    for raw in attempts:
        event_id = str(raw.get("client_event_id")) if isinstance(raw, dict) else None
        if not isinstance(raw, dict):
            rejected.append({"client_event_id": None, "error": "Each attempt must be an object."})
            continue
        fields, problem = _clean_attempt(request.user, raw)
        if problem:
            rejected.append({"client_event_id": event_id, "error": problem})
            continue
        if QuizAttempt.objects.filter(client_event_id=fields["client_event_id"]).exists():
            duplicates.append(event_id)
            continue
        try:
            with transaction.atomic():
                QuizAttempt.objects.create(**fields)
            applied.append(event_id)
        except IntegrityError:  # two devices sent the same id at once
            duplicates.append(event_id)

    return Response({"applied": applied, "duplicates": duplicates, "rejected": rejected})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def quiz_attempts_list(request):
    """Only ever the signed-in user's own attempts."""
    attempts = QuizAttempt.objects.filter(user=request.user).select_related("lesson")[:500]
    return Response([attempt_payload(a) for a in attempts])
