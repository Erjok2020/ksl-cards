from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views, views_content

"""URL routes for the API endpoints used by the app."""

urlpatterns = [
    # Auth (JWT)
    path("api/register/", views.register, name="register"),
    path("api/login/", views.login, name="login"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("api/me/", views.me, name="me"),
    path("api/password/change/", views.change_password, name="change-password"),
    # Learner content
    path("api/lessons/", views.lesson_list, name="lesson-list"),
    path("api/lessons/<int:lesson_id>/cards/", views.lesson_cards, name="lesson-cards"),
    # Content management (teachers, admins)
    path("api/manage/lessons/", views.manage_lessons, name="manage-lessons"),
    path("api/manage/cards/", views.manage_cards, name="manage-cards"),
    path("api/manage/cards/<int:card_id>/", views.manage_card_detail, name="manage-card-detail"),
    # Sign review (Deaf KSL reviewers)
    path("api/reviews/pending/", views.pending_reviews, name="pending-reviews"),
    path("api/cards/<int:card_id>/review/", views.review_card, name="review-card"),
    # User management (admins)
    path("api/users/", views.user_list, name="user-list"),
    path("api/users/<int:user_id>/", views.user_role, name="user-role"),
    path("api/users/<int:user_id>/reset-password/", views.reset_password, name="reset-password"),
    # Progress
    path("api/progress/", views.save_progress, name="save-progress"),
    path("api/progress/sync/", views.sync_progress, name="sync-progress"),
    path("api/progress/me/", views.user_progress, name="user-progress"),
    # FAQ and policy pages (public, read-only)
    path("api/faq/", views_content.faq_list, name="faq-list"),
    path("api/pages/<slug:slug>/", views_content.policy_page, name="policy-page"),
    # Feedback (anonymous allowed, rate-limited)
    path("api/feedback/", views_content.feedback_create, name="feedback-create"),
    # Lesson checks
    path("api/quiz-attempts/", views_content.quiz_attempts_list, name="quiz-attempts"),
    path("api/quiz-attempts/sync/", views_content.quiz_attempts_sync, name="quiz-attempts-sync"),
]
