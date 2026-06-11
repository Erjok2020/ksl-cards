"""ASGI entry point for the KSL Cards project."""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ksl_backend.settings')

application = get_asgi_application()
