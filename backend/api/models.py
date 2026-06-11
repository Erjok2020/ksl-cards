# KSL Cards - Database models for Lesson, KSLCard and Progress tables
# from django.db import models
from django.contrib.auth.models import User


class Lesson(models.Model):
    title       = models.CharField(max_length=120)
    category    = models.CharField(max_length=60)
    description = models.TextField(blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    def card_count(self):
        return self.kslcard_set.count()

    def __str__(self):
        return self.title

    class Meta:
        ordering = ["title"]


class KSLCard(models.Model):
    lesson      = models.ForeignKey(Lesson, on_delete=models.CASCADE)
    meaning     = models.CharField(max_length=120)
    description = models.TextField()
    image_url   = models.CharField(max_length=300, blank=True)
    category    = models.CharField(max_length=60, blank=True)

    def __str__(self):
        return f"{self.meaning} ({self.lesson.title})"

    class Meta:
        ordering = ["meaning"]


class Progress(models.Model):
    user        = models.ForeignKey(User, on_delete=models.CASCADE)
    lesson      = models.ForeignKey(Lesson, on_delete=models.CASCADE)
    completion  = models.BooleanField(default=False)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "lesson")

    def __str__(self):
        status = "done" if self.completion else "in progress"
        return f"{self.user.username} — {self.lesson.title} ({status})"