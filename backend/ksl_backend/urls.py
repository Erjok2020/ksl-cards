from django.contrib import admin
from django.urls import include, path, re_path

from api.media import serve_media

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('api.urls')),
    # Sign videos and posters. Served by Django with Range support so video
    # seeking works in every browser; behind nginx in Docker as well.
    re_path(r'^media/(?P<path>.+)$', serve_media, name='media'),
]
