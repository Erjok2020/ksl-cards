"""Move to the proposal's data model (class diagram / ERD).

Renames keep existing card text. Existing cards were never reviewed by a
Deaf KSL reviewer, so they are kept visible but flagged as samples, which
makes the UI label them as unreviewed. Old "completion" strings become the
new completed flag.
"""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
import uuid


def forwards(apps, schema_editor):
    KSLCard = apps.get_model("api", "KSLCard")
    Progress = apps.get_model("api", "Progress")
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))
    UserProfile = apps.get_model("api", "UserProfile")

    KSLCard.objects.all().update(review_status="approved", is_sample=True)

    for p in Progress.objects.all():
        p.completed = p.completion in ("completed", "1", "True", "true")
        if p.completed:
            p.completed_cards = KSLCard.objects.filter(lesson_id=p.lesson_id).count()
        p.save(update_fields=["completed", "completed_cards"])

    for u in User.objects.all():
        UserProfile.objects.get_or_create(
            user=u, defaults={"role": "admin" if u.is_superuser else "learner"}
        )


def backwards(apps, schema_editor):
    Progress = apps.get_model("api", "Progress")
    for p in Progress.objects.all():
        p.completion = "completed" if p.completed else (
            "in_progress" if p.completed_cards else "not_started"
        )
        p.save(update_fields=["completion"])


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0005_alter_kslcard_options_kslcard_order"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Lesson
        migrations.AddField(
            model_name="lesson",
            name="module",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="lesson",
            name="sort_order",
            field=models.IntegerField(default=0),
        ),
        migrations.AlterModelOptions(
            name="lesson",
            options={"ordering": ["module", "sort_order", "title"]},
        ),
        # KSLCard
        migrations.RenameField("kslcard", "meaning", "english_word"),
        migrations.RenameField("kslcard", "description", "movement_description"),
        migrations.AlterField(
            model_name="kslcard",
            name="movement_description",
            field=models.TextField(blank=True),
        ),
        migrations.RenameField("kslcard", "image_url", "poster"),
        migrations.AlterField(
            model_name="kslcard",
            name="poster",
            # Same length as the old image_url column, so existing links are
            # never cut short (MySQL refuses to shrink a column with longer data).
            field=models.FileField(blank=True, max_length=300, upload_to="posters/"),
        ),
        migrations.RemoveField(model_name="kslcard", name="category"),
        migrations.AddField(
            model_name="kslcard",
            name="context_sentence",
            field=models.CharField(blank=True, max_length=300),
        ),
        migrations.AddField(
            model_name="kslcard",
            name="video",
            field=models.FileField(blank=True, upload_to="signs/"),
        ),
        migrations.AddField(
            model_name="kslcard",
            name="file_size_kb",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="kslcard",
            name="poster_size_kb",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="kslcard",
            name="review_status",
            field=models.CharField(
                choices=[("pending", "Pending review"), ("approved", "Approved"), ("rejected", "Rejected")],
                default="pending",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="kslcard",
            name="is_sample",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="kslcard",
            name="uploaded_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="uploaded_cards",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="kslcard",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AlterModelOptions(
            name="kslcard",
            options={"ordering": ["order", "id"]},
        ),
        # Roles
        migrations.CreateModel(
            name="UserProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("learner", "Learner"),
                            ("teacher", "Teacher"),
                            ("reviewer", "Deaf KSL reviewer"),
                            ("admin", "Administrator"),
                        ],
                        default="learner",
                        max_length=20,
                    ),
                ),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        # Reviews
        migrations.CreateModel(
            name="SignReview",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "decision",
                    models.CharField(
                        choices=[("approved", "Approved"), ("revise", "Re-record requested"), ("rejected", "Rejected")],
                        max_length=20,
                    ),
                ),
                ("notes", models.TextField(blank=True)),
                ("reviewed_at", models.DateTimeField(auto_now_add=True)),
                (
                    "card",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="reviews", to="api.kslcard"
                    ),
                ),
                (
                    "reviewer",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="sign_reviews",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-reviewed_at"]},
        ),
        # Progress
        migrations.AddField(
            model_name="progress",
            name="completed_cards",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="progress",
            name="completed",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="progress",
            name="client_event_id",
            field=models.UUIDField(blank=True, null=True, unique=True),
        ),
        migrations.CreateModel(
            name="ProgressEvent",
            fields=[
                ("client_event_id", models.UUIDField(default=uuid.uuid4, primary_key=True, serialize=False)),
                ("completed_cards", models.PositiveIntegerField(default=0)),
                ("completed", models.BooleanField(default=False)),
                ("received_at", models.DateTimeField(auto_now_add=True)),
                ("lesson", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="api.lesson")),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL
                    ),
                ),
            ],
            options={"ordering": ["-received_at"]},
        ),
        migrations.RunPython(forwards, backwards),
        migrations.RemoveField(model_name="progress", name="completion"),
    ]
