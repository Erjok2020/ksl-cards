from django.contrib import admin

from .models import (
    FAQEntry,
    Feedback,
    KSLCard,
    Lesson,
    PolicyPage,
    Progress,
    ProgressEvent,
    QuizAttempt,
    SignReview,
    UserProfile,
)


class KSLCardInline(admin.TabularInline):
    model = KSLCard
    extra = 0
    fields = ("english_word", "review_status", "is_sample", "order")
    readonly_fields = ("review_status",)


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ("title", "module", "category", "sort_order", "created_at")
    list_filter = ("module", "category")
    search_fields = ("title", "category", "module")
    inlines = [KSLCardInline]


class SignReviewInline(admin.TabularInline):
    model = SignReview
    extra = 0
    readonly_fields = ("reviewer", "decision", "notes", "reviewed_at")
    can_delete = False


@admin.register(KSLCard)
class KSLCardAdmin(admin.ModelAdmin):
    list_display = ("english_word", "lesson", "review_status", "is_sample", "file_size_kb", "uploaded_by")
    list_filter = ("review_status", "is_sample", "lesson__module", "lesson")
    search_fields = ("english_word", "kiswahili", "context_sentence", "movement_description")
    # Review status changes only through a SignReview, which keeps the audit trail.
    readonly_fields = ("review_status", "file_size_kb", "poster_size_kb")
    inlines = [SignReviewInline]


@admin.register(SignReview)
class SignReviewAdmin(admin.ModelAdmin):
    list_display = ("card", "decision", "reviewer", "reviewed_at")
    list_filter = ("decision",)
    readonly_fields = ("reviewed_at",)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role")
    list_filter = ("role",)
    search_fields = ("user__username",)


@admin.register(Progress)
class ProgressAdmin(admin.ModelAdmin):
    list_display = ("user", "lesson", "completed_cards", "completed", "updated_at")
    list_filter = ("completed", "lesson")
    search_fields = ("user__username",)


@admin.register(ProgressEvent)
class ProgressEventAdmin(admin.ModelAdmin):
    list_display = ("client_event_id", "user", "lesson", "completed_cards", "completed", "received_at")
    readonly_fields = ("client_event_id", "user", "lesson", "completed_cards", "completed", "received_at")


@admin.register(FAQEntry)
class FAQEntryAdmin(admin.ModelAdmin):
    list_display = ("question", "category", "order", "is_published")
    list_filter = ("category", "is_published")
    list_editable = ("order", "is_published")
    search_fields = ("question", "answer")
    prepopulated_fields = {}


@admin.register(PolicyPage)
class PolicyPageAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "is_draft", "updated_at")
    list_filter = ("is_draft",)
    search_fields = ("title", "body")
    readonly_fields = ("updated_at",)


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ("short_message", "status", "rating", "page", "user", "created_at")
    list_filter = ("status", "rating", "created_at")
    list_editable = ("status",)
    search_fields = ("message", "page")
    date_hierarchy = "created_at"
    # The message is what the person sent: staff set the status, nothing else.
    readonly_fields = ("user", "page", "rating", "message", "created_at")

    @admin.display(description="Message")
    def short_message(self, obj):
        return obj.message[:80] + ("…" if len(obj.message) > 80 else "")

    def has_add_permission(self, request):
        return False


@admin.register(QuizAttempt)
class QuizAttemptAdmin(admin.ModelAdmin):
    """Read-only: these records feed the learning-outcome evaluation."""

    list_display = ("user", "lesson", "score", "total", "completed_at")
    list_filter = ("lesson", "user", "completed_at")
    date_hierarchy = "completed_at"
    readonly_fields = ("user", "lesson", "score", "total", "answers", "client_event_id", "completed_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


admin.site.site_header = "KSL Cards administration"
admin.site.site_title = "KSL Cards admin"
admin.site.index_title = "Content, accounts and records"
