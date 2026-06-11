from django.urls import path
from . import views

urlpatterns = [
    path('api/register/',                        views.register,      name='register'),
    path('api/login/',                           views.login,         name='login'),
    path('api/lessons/',                         views.lesson_list,   name='lesson-list'),
    path('api/lessons/<int:lesson_id>/cards/',   views.lesson_cards,  name='lesson-cards'),
    path('api/progress/',                        views.save_progress, name='save-progress'),
    path('api/progress/me/',                     views.user_progress, name='user-progress'),
]