"""API views for authentication, lessons, cards, reviews, users and progress."""

import secrets
import uuid

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.db.models import Case, Count, IntegerField, Q, Value, When
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import KSLCard, Lesson, Progress, ProgressEvent, Role, SignReview, UserProfile, role_of
from .permissions import IsAdmin, IsReviewer, IsTeacher

APPROVED = KSLCard.ReviewStatus.APPROVED
MAX_VIDEO_MB = 25
VIDEO_TYPES = {"video/mp4", "video/webm"}
POSTER_TYPES = {"image/jpeg", "image/png", "image/webp"}


# ---------- helpers ----------

def user_payload(user):
    profile = getattr(user, "profile", None)
    return {
        "id": user.id,
        "username": user.username,
        "role": role_of(user),
        "must_change_password": bool(profile and profile.must_change_password),
    }


def auth_payload(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": user_payload(user),
    }


def file_url(request, f):
    return request.build_absolute_uri(f.url) if f else ""


def card_payload(request, card, include_review=False):
    data = {
        "id": card.id,
        "lesson_id": card.lesson_id,
        "english_word": card.english_word,
        "context_sentence": card.context_sentence,
        "movement_description": card.movement_description,
        "kiswahili": card.kiswahili,
        "reviewed": card.is_reviewed(),
        "video_url": file_url(request, card.video),
        "poster_url": file_url(request, card.poster),
        "file_size_kb": card.file_size_kb + card.poster_size_kb,
        "is_sample": card.is_sample,
        "order": card.order,
    }
    if include_review:
        last = card.reviews.first()
        data.update(
            {
                "lesson_title": card.lesson.title,
                "review_status": card.review_status,
                "uploaded_by": card.uploaded_by.username if card.uploaded_by else None,
                "last_review": (
                    {
                        "decision": last.decision,
                        "notes": last.notes,
                        "reviewer": last.reviewer.username if last.reviewer else None,
                        "reviewed_at": last.reviewed_at,
                    }
                    if last
                    else None
                ),
            }
        )
    return data


def lesson_payload(lesson, card_count=None):
    return {
        "id": lesson.id,
        "title": lesson.title,
        "module": lesson.module,
        "category": lesson.category,
        "description": lesson.description,
        "sort_order": lesson.sort_order,
        "card_count": card_count if card_count is not None else lesson.approved_cards().count(),
        "reviewed_count": lesson.approved_cards().filter(is_sample=False).count(),
        "download_size_kb": lesson.download_size_kb(),
    }


def error(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({"error": message}, status=code)


# ---------- auth (FR-01) ----------

@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    username = str(request.data.get("username", "")).strip()
    password = str(request.data.get("password", ""))

    if not username or not password:
        return error("Username and password are required.")
    if len(password) < 6:
        return error("Password must be at least 6 characters.")
    if User.objects.filter(username__iexact=username).exists():
        return error("That username is already taken. Please choose a different one.")

    user = User.objects.create_user(username=username, password=password)
    return Response(auth_payload(user), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    user = authenticate(
        username=request.data.get("username", ""),
        password=request.data.get("password", ""),
    )
    if not user:
        return error("Wrong username or password.", status.HTTP_401_UNAUTHORIZED)
    return Response(auth_payload(user))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(user_payload(request.user))


# ---------- passwords ----------
# The app stores no email or phone number (proposal Section 3.10), so there
# is no "email me a link" reset. A signed-in user can change their password;
# for a forgotten one, an administrator sets a temporary password in person.

MIN_PASSWORD_LENGTH = 6
# No look-alike characters (0/O, 1/l/I), so it is easy to read out and type.
TEMP_PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    current = str(request.data.get("current_password", ""))
    new = str(request.data.get("new_password", ""))
    if not request.user.check_password(current):
        return error("Your current password is not correct.")
    if len(new) < MIN_PASSWORD_LENGTH:
        return error(f"The new password must be at least {MIN_PASSWORD_LENGTH} characters.")
    if new == current:
        return error("Choose a password that is different from the current one.")
    request.user.set_password(new)
    request.user.save()
    UserProfile.objects.update_or_create(
        user=request.user, defaults={"must_change_password": False}
    )
    request.user.refresh_from_db()
    return Response(auth_payload(request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdmin])
def reset_password(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return error("User not found.", status.HTTP_404_NOT_FOUND)
    if user.id == request.user.id:
        return error("Use Change password to change your own password.")
    temporary = "".join(secrets.choice(TEMP_PASSWORD_ALPHABET) for _ in range(8))
    user.set_password(temporary)
    user.save()
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.must_change_password = True
    profile.save()
    # Shown to the administrator once; only the hash is stored.
    return Response({"username": user.username, "temporary_password": temporary})


# ---------- learner content (FR-02, FR-03) ----------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def lesson_list(request):
    lessons = Lesson.objects.annotate(
        num_cards=Count("kslcard", filter=Q(kslcard__review_status=APPROVED))
    ).filter(num_cards__gt=0).order_by("module", "sort_order", "title")
    return Response([lesson_payload(l, l.num_cards) for l in lessons])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def lesson_cards(request, lesson_id):
    try:
        lesson = Lesson.objects.get(id=lesson_id)
    except Lesson.DoesNotExist:
        return error("Lesson not found.", status.HTTP_404_NOT_FOUND)
    # Only signs approved by a Deaf KSL reviewer are published. Staff can
    # preview the rest with ?include_pending=1; each card then carries its
    # review status so the preview is never mistaken for published content.
    staff = role_of(request.user) in (Role.TEACHER, Role.REVIEWER, Role.ADMIN)
    if staff and request.query_params.get("include_pending") == "1":
        cards = lesson.kslcard_set.exclude(review_status=KSLCard.ReviewStatus.REJECTED)
        return Response([card_payload(request, c, include_review=True) for c in cards])
    cards = lesson.approved_cards()
    return Response([card_payload(request, c) for c in cards])


# ---------- content management (FR-06) ----------

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsTeacher])
def manage_lessons(request):
    if request.method == "GET":
        lessons = Lesson.objects.annotate(total=Count("kslcard")).order_by("module", "sort_order", "title")
        return Response(
            [{**lesson_payload(l), "total_cards": l.total} for l in lessons]
        )

    title = str(request.data.get("title", "")).strip()
    category = str(request.data.get("category", "")).strip()
    if not title or not category:
        return error("Title and category are required.")
    try:
        lesson = Lesson.objects.create(
            title=title,
            category=category,
            module=str(request.data.get("module", "")).strip(),
            description=str(request.data.get("description", "")).strip(),
            sort_order=int(request.data.get("sort_order") or 0),
        )
    except IntegrityError:
        return error("A lesson with that title and category already exists.")
    except ValueError:
        return error("Sort order must be a number.")
    return Response(lesson_payload(lesson), status=status.HTTP_201_CREATED)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsTeacher])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def manage_cards(request):
    if request.method == "GET":
        # Signs waiting for review first, then real recordings before the
        # sample placeholders, newest first, so new uploads are easy to find.
        status_order = Case(
            When(review_status=KSLCard.ReviewStatus.PENDING, then=Value(0)),
            When(review_status=KSLCard.ReviewStatus.REJECTED, then=Value(1)),
            default=Value(2),
            output_field=IntegerField(),
        )
        cards = (
            KSLCard.objects.select_related("lesson", "uploaded_by")
            .prefetch_related("reviews")
            .order_by(status_order, "is_sample", "-id")
        )
        if role_of(request.user) != Role.ADMIN:
            cards = cards.filter(uploaded_by=request.user)
        return Response([card_payload(request, c, include_review=True) for c in cards])

    try:
        lesson = Lesson.objects.get(id=request.data.get("lesson_id"))
    except (Lesson.DoesNotExist, ValueError, TypeError):
        return error("Choose a lesson for this card.")

    english_word = str(request.data.get("english_word", "")).strip()
    if not english_word:
        return error("The English word is required.")

    video = request.FILES.get("video")
    poster = request.FILES.get("poster")
    if not video:
        return error("A sign video is required.")
    if video.content_type not in VIDEO_TYPES:
        return error("Video must be MP4 or WebM.")
    if video.size > MAX_VIDEO_MB * 1024 * 1024:
        return error(f"Video must be smaller than {MAX_VIDEO_MB} MB.")
    if poster and poster.content_type not in POSTER_TYPES:
        return error("Poster must be a JPEG, PNG or WebP image.")

    card = KSLCard(
        lesson=lesson,
        english_word=english_word,
        context_sentence=str(request.data.get("context_sentence", "")).strip(),
        kiswahili=str(request.data.get("kiswahili", "")).strip(),
        movement_description=str(request.data.get("movement_description", "")).strip(),
        uploaded_by=request.user,
        order=lesson.kslcard_set.count() + 1,
        review_status=KSLCard.ReviewStatus.PENDING,
    )
    card.video.save(f"{uuid.uuid4().hex}_{video.name}", video, save=False)
    if poster:
        card.poster.save(f"{uuid.uuid4().hex}_{poster.name}", poster, save=False)
    card.save()
    return Response(card_payload(request, card, include_review=True), status=status.HTTP_201_CREATED)


@api_view(["DELETE", "PATCH"])
@permission_classes([IsAuthenticated, IsTeacher])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def manage_card_detail(request, card_id):
    try:
        card = KSLCard.objects.get(id=card_id)
    except KSLCard.DoesNotExist:
        return error("Card not found.", status.HTTP_404_NOT_FOUND)
    if role_of(request.user) != Role.ADMIN and card.uploaded_by_id != request.user.id:
        return error("You can only change cards you uploaded.", status.HTTP_403_FORBIDDEN)

    if request.method == "PATCH":
        # Replace the recording (e.g. after "re-record requested") or correct
        # the text. Any change sends the card back to the review queue.
        video = request.FILES.get("video")
        poster = request.FILES.get("poster")
        if video:
            if video.content_type not in VIDEO_TYPES:
                return error("Video must be MP4 or WebM.")
            if video.size > MAX_VIDEO_MB * 1024 * 1024:
                return error(f"Video must be smaller than {MAX_VIDEO_MB} MB.")
        if poster and poster.content_type not in POSTER_TYPES:
            return error("Poster must be a JPEG, PNG or WebP image.")
        for field in ("english_word", "context_sentence", "kiswahili", "movement_description"):
            if field in request.data:
                value = str(request.data.get(field, "")).strip()
                if field == "english_word" and not value:
                    return error("The English word is required.")
                setattr(card, field, value)
        if video:
            card.video.delete(save=False)
            card.video.save(f"{uuid.uuid4().hex}_{video.name}", video, save=False)
            card.is_sample = False
        if poster:
            card.poster.delete(save=False)
            card.poster.save(f"{uuid.uuid4().hex}_{poster.name}", poster, save=False)
        card.review_status = KSLCard.ReviewStatus.PENDING
        card.save()
        return Response(card_payload(request, card, include_review=True))

    card.video.delete(save=False)
    card.poster.delete(save=False)
    card.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ---------- sign review (Section 3.9) ----------

@api_view(["GET"])
@permission_classes([IsAuthenticated, IsReviewer])
def pending_reviews(request):
    cards = (
        KSLCard.objects.filter(review_status=KSLCard.ReviewStatus.PENDING)
        .exclude(uploaded_by=request.user)
        .select_related("lesson", "uploaded_by")
        .prefetch_related("reviews")
    )
    return Response([card_payload(request, c, include_review=True) for c in cards])


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsReviewer])
def review_card(request, card_id):
    try:
        card = KSLCard.objects.get(id=card_id)
    except KSLCard.DoesNotExist:
        return error("Card not found.", status.HTTP_404_NOT_FOUND)
    if card.uploaded_by_id == request.user.id:
        return error("You cannot review a sign you uploaded.", status.HTTP_403_FORBIDDEN)

    decision = request.data.get("decision")
    if decision not in SignReview.Decision.values:
        return error("Decision must be approved, revise or rejected.")
    notes = str(request.data.get("notes", "")).strip()
    if decision != SignReview.Decision.APPROVED and not notes:
        return error("Please add a note explaining what needs to change.")
    if decision == SignReview.Decision.APPROVED and not card.video:
        return error("A sign needs a video before it can be approved.")

    SignReview.objects.create(card=card, reviewer=request.user, decision=decision, notes=notes)
    card.refresh_from_db()
    return Response(card_payload(request, card, include_review=True))


# ---------- user management ----------

@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdmin])
def user_list(request):
    users = User.objects.select_related("profile").order_by("username")
    return Response([user_payload(u) for u in users])


@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsAdmin])
def user_role(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return error("User not found.", status.HTTP_404_NOT_FOUND)
    role = request.data.get("role")
    if role not in Role.values:
        return error("Unknown role.")
    if user.id == request.user.id and role != Role.ADMIN:
        return error("You cannot remove your own administrator role.")
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.role = role
    profile.save()
    return Response(user_payload(user))


# ---------- progress (FR-04, NFR-02) ----------

def apply_progress_event(user, event):
    """Apply one progress event. Returns (status, progress) where status is
    'applied', 'duplicate' or an error string. Progress only moves forward,
    so events arriving out of order cannot undo work."""
    try:
        event_id = uuid.UUID(str(event.get("client_event_id")))
    except (ValueError, TypeError):
        return "client_event_id must be a UUID.", None
    try:
        lesson = Lesson.objects.get(id=event.get("lesson_id"))
    except (Lesson.DoesNotExist, ValueError, TypeError):
        return "Lesson not found.", None

    try:
        completed_cards = max(0, int(event.get("completed_cards") or 0))
    except (ValueError, TypeError):
        return "completed_cards must be a number.", None
    completed = bool(event.get("completed"))

    with transaction.atomic():
        if ProgressEvent.objects.filter(client_event_id=event_id).exists():
            return "duplicate", Progress.objects.filter(user=user, lesson=lesson).first()
        ProgressEvent.objects.create(
            client_event_id=event_id,
            user=user,
            lesson=lesson,
            completed_cards=completed_cards,
            completed=completed,
        )
        progress, _ = Progress.objects.select_for_update().get_or_create(user=user, lesson=lesson)
        progress.completed_cards = max(progress.completed_cards, completed_cards)
        progress.completed = progress.completed or completed
        progress.client_event_id = event_id
        progress.save()
    return "applied", progress


def progress_payload(p):
    return {
        "lesson_id": p.lesson_id,
        "lesson": p.lesson.title,
        "module": p.lesson.module,
        "completed_cards": p.completed_cards,
        "card_count": p.lesson.approved_cards().count(),
        "completed": p.completed,
        "updated_at": p.updated_at,
    }


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def save_progress(request):
    result, progress = apply_progress_event(request.user, request.data)
    if result not in ("applied", "duplicate"):
        return error(result)
    return Response({"status": result, **progress_payload(progress)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sync_progress(request):
    events = request.data.get("events")
    if not isinstance(events, list):
        return error("events must be a list.")
    if len(events) > 500:
        return error("Send at most 500 events at a time.")

    applied, duplicates, rejected = [], [], []
    for event in events:
        event_id = str(event.get("client_event_id")) if isinstance(event, dict) else None
        if not isinstance(event, dict):
            rejected.append({"client_event_id": None, "error": "Each event must be an object."})
            continue
        result, _ = apply_progress_event(request.user, event)
        if result == "applied":
            applied.append(event_id)
        elif result == "duplicate":
            duplicates.append(event_id)
        else:
            rejected.append({"client_event_id": event_id, "error": result})

    records = Progress.objects.filter(user=request.user).select_related("lesson")
    return Response(
        {
            "applied": applied,
            "duplicates": duplicates,
            "rejected": rejected,
            "progress": [progress_payload(p) for p in records],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_progress(request):
    records = Progress.objects.filter(user=request.user).select_related("lesson")
    return Response([progress_payload(p) for p in records])
