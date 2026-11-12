"""Data models for KSL Cards.

Mirrors the class diagram and ERD in the proposal (Sections 3.4 and 3.6.3):
Lesson, KSLCard, SignReview, Progress and a role per user. Only cards whose
review_status is "approved" are ever shown to learners.
"""

import uuid

from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class Role(models.TextChoices):
    LEARNER = "learner", "Learner"
    TEACHER = "teacher", "Teacher"
    REVIEWER = "reviewer", "Deaf KSL reviewer"
    ADMIN = "admin", "Administrator"


class UserProfile(models.Model):
    """Holds the user's role. Roles are an enumeration, not subclasses,
    so permission checks stay simple (Section 3.4)."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile"
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.LEARNER)
    # Set when an administrator resets a forgotten password: the user must
    # choose their own password at next sign-in.
    must_change_password = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.username} ({self.role})"


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_profile(sender, instance, created, **kwargs):
    if created:
        role = Role.ADMIN if instance.is_superuser else Role.LEARNER
        UserProfile.objects.get_or_create(user=instance, defaults={"role": role})


def role_of(user):
    if not user or not user.is_authenticated:
        return None
    if user.is_superuser:
        return Role.ADMIN
    profile = getattr(user, "profile", None)
    if profile is None:
        profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile.role


class Lesson(models.Model):
    title = models.CharField(max_length=120)
    module = models.CharField(max_length=120, blank=True, default="")
    category = models.CharField(max_length=60)
    description = models.TextField(blank=True)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def approved_cards(self):
        return self.kslcard_set.filter(review_status=KSLCard.ReviewStatus.APPROVED)

    def download_size_kb(self):
        return sum(c.file_size_kb + c.poster_size_kb for c in self.approved_cards())

    def __str__(self):
        return self.title

    class Meta:
        ordering = ["module", "sort_order", "title"]
        unique_together = ("title", "category")


class KSLCard(models.Model):
    class ReviewStatus(models.TextChoices):
        PENDING = "pending", "Pending review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE)
    english_word = models.CharField(max_length=120)
    context_sentence = models.CharField(max_length=300, blank=True)
    kiswahili = models.CharField(
        max_length=200, blank=True, help_text="Kiswahili translation of the English word (optional)."
    )
    # Written movement description: the fallback when video is unavailable
    # (Section 3.9) and extra support alongside the video (UDL).
    movement_description = models.TextField(blank=True)
    video = models.FileField(upload_to="signs/", blank=True)
    poster = models.FileField(upload_to="posters/", blank=True)
    file_size_kb = models.PositiveIntegerField(default=0)
    poster_size_kb = models.PositiveIntegerField(default=0)
    review_status = models.CharField(
        max_length=20, choices=ReviewStatus.choices, default=ReviewStatus.PENDING
    )
    # Placeholder clips that were never reviewed by a Deaf KSL reviewer.
    # The UI always labels these so they are never presented as official KSL.
    is_sample = models.BooleanField(default=False)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_cards",
    )
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    def save(self, *args, **kwargs):
        for field, size_field in (("video", "file_size_kb"), ("poster", "poster_size_kb")):
            f = getattr(self, field)
            if f:
                try:
                    setattr(self, size_field, max(1, round(f.size / 1024)))
                except (OSError, FileNotFoundError):
                    pass
            else:
                setattr(self, size_field, 0)
        super().save(*args, **kwargs)

    def is_published(self):
        return self.review_status == self.ReviewStatus.APPROVED

    def is_reviewed(self):
        """True only for a real recording approved by a Deaf KSL reviewer.
        Sample placeholder clips are visible but were never reviewed."""
        return self.is_published() and not self.is_sample

    def __str__(self):
        return f"{self.english_word} ({self.lesson.title})"

    class Meta:
        ordering = ["order", "id"]


class SignReview(models.Model):
    """A Deaf KSL reviewer's decision on a card. Each decision is kept, so
    the table is an audit trail of approvals (Section 3.6.3)."""

    class Decision(models.TextChoices):
        APPROVED = "approved", "Approved"
        REVISE = "revise", "Re-record requested"
        REJECTED = "rejected", "Rejected"

    card = models.ForeignKey(KSLCard, on_delete=models.CASCADE, related_name="reviews")
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="sign_reviews"
    )
    decision = models.CharField(max_length=20, choices=Decision.choices)
    notes = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(auto_now_add=True)

    STATUS_FOR_DECISION = {
        Decision.APPROVED: KSLCard.ReviewStatus.APPROVED,
        Decision.REVISE: KSLCard.ReviewStatus.PENDING,
        Decision.REJECTED: KSLCard.ReviewStatus.REJECTED,
    }

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.card.review_status = self.STATUS_FOR_DECISION[self.decision]
        self.card.save(update_fields=["review_status"])

    def __str__(self):
        return f"{self.card.english_word}: {self.decision}"

    class Meta:
        ordering = ["-reviewed_at"]


class Progress(models.Model):
    """Per-learner, per-lesson progress. Only completion is recorded, not
    detailed interactions (Section 3.4)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE)
    completed_cards = models.PositiveIntegerField(default=0)
    completed = models.BooleanField(default=False)
    # The most recent client event applied to this row.
    client_event_id = models.UUIDField(unique=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "lesson")
        verbose_name_plural = "Progress"

    def __str__(self):
        status = "done" if self.completed else f"{self.completed_cards} cards"
        return f"{self.user.username} — {self.lesson.title} ({status})"


class ProgressEvent(models.Model):
    """Every client event id the server has accepted. Lets offline queues be
    re-sent safely: an id seen before is ignored, so no duplicates."""

    client_event_id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE)
    completed_cards = models.PositiveIntegerField(default=0)
    completed = models.BooleanField(default=False)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-received_at"]


class FAQEntry(models.Model):
    """A question on the FAQ page. Editable in the admin."""

    class Category(models.TextChoices):
        LEARNING = "learning", "Learning"
        OFFLINE = "offline", "Offline use"
        ACCOUNT = "account", "Account"

    category = models.CharField(max_length=20, choices=Category.choices)
    question = models.CharField(max_length=200)
    answer = models.TextField()
    # Optional short name so other pages can link straight to this question
    # (e.g. /faq#signers).
    slug = models.SlugField(max_length=40, blank=True)
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)

    class Meta:
        ordering = ["category", "order", "id"]
        verbose_name = "FAQ entry"
        verbose_name_plural = "FAQ entries"

    def __str__(self):
        return self.question


class PolicyPage(models.Model):
    """A plain-language page such as the privacy policy. Editable in the admin.

    Body format: a line starting with "## " is a section heading, a line
    starting with "- " is a bullet, a line starting with "> " is the short
    summary box, and anything else is a paragraph.
    """

    slug = models.SlugField(unique=True)
    title = models.CharField(max_length=120)
    body = models.TextField(
        help_text='Use "## Heading" for sections, "- " for bullets and "> " for the summary box.'
    )
    # Shown as a "Draft" notice until the supervisor / ethics review signs it off.
    is_draft = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class Feedback(models.Model):
    """A message sent from the feedback form. Anonymous by default: `user`
    is only filled in when the sender ticks "include my username"."""

    class Status(models.TextChoices):
        NEW = "new", "New"
        IN_REVIEW = "in_review", "In review"
        RESOLVED = "resolved", "Resolved"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    page = models.CharField(max_length=200, blank=True, help_text="Page the feedback is about.")
    rating = models.PositiveSmallIntegerField(null=True, blank=True)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "Feedback"

    def __str__(self):
        return f"{self.get_status_display()}: {self.message[:50]}"


class QuizAttempt(models.Model):
    """One completed lesson check. Questions are generated on the device from
    the lesson's approved cards, so only the result is stored."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE)
    score = models.PositiveSmallIntegerField()
    total = models.PositiveSmallIntegerField()
    # [{"card_id": 1, "chosen_card_id": 3, "correct": false}, ...]
    answers = models.JSONField(default=list)
    client_event_id = models.UUIDField(unique=True)
    completed_at = models.DateTimeField()

    class Meta:
        ordering = ["-completed_at"]

    def __str__(self):
        return f"{self.user.username} - {self.lesson.title}: {self.score} of {self.total}"
