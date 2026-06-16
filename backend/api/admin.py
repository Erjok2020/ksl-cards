from django.contrib import admin

from .models import KSLCard, Lesson, Progress

"""Admin configuration for the API app."""

admin.site.register(Lesson)
admin.site.register(KSLCard)
admin.site.register(Progress)
