"""WSGI entry point for the KSL Cards project."""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ksl_backend.settings')

application = get_wsgi_application()
