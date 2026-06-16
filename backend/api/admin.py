from django.contrib import admin

from .models import KSLCard, Lesson, Progress


class KSLCardInline(admin.TabularInline):
    model = KSLCard
    extra = 1


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "card_count", "created_at")
    list_filter = ("category",)
    search_fields = ("title", "category")
    inlines = [KSLCardInline]


@admin.register(KSLCard)
class KSLCardAdmin(admin.ModelAdmin):
    list_display = ("meaning", "lesson", "category")
    list_filter = ("lesson", "category")
    search_fields = ("meaning", "description")


@admin.register(Progress)
class ProgressAdmin(admin.ModelAdmin):
    list_display = ("user", "lesson", "completion", "updated_at")
    list_filter = ("completion", "lesson")
    search_fields = ("user__username",)
