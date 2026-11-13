"""Serve uploaded media with HTTP Range support.

Browsers (Safari in particular) request sign videos in byte ranges and
refuse to play them if the server ignores Range. Django's built-in static
serve view does not support ranges, so this small view does.
"""

import mimetypes
import os
import re

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse
from django.utils._os import safe_join
from django.views.decorators.http import require_safe

from .models import bundled_sample_path

RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)$")
CHUNK = 64 * 1024


def _iter_file(path, start, length):
    with open(path, "rb") as f:
        f.seek(start)
        remaining = length
        while remaining > 0:
            chunk = f.read(min(CHUNK, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


@require_safe
def serve_media(request, path):
    try:
        full_path = safe_join(settings.MEDIA_ROOT, path)
    except Exception:
        raise Http404("Not found")
    if not os.path.isfile(full_path):
        # Sample clips ship with the code. Serve them from there when uploads
        # live on a separate volume and the copy hasn't been made.
        bundled = bundled_sample_path(path)
        if bundled is None:
            raise Http404("Not found")
        full_path = str(bundled)

    size = os.path.getsize(full_path)
    content_type = mimetypes.guess_type(full_path)[0] or "application/octet-stream"
    range_header = request.headers.get("Range", "")
    match = RANGE_RE.match(range_header.strip())

    if match and (match.group(1) or match.group(2)):
        first, last = match.groups()
        if first:
            start = int(first)
            end = int(last) if last else size - 1
        else:  # suffix range: last N bytes
            start = max(0, size - int(last))
            end = size - 1
        end = min(end, size - 1)
        if start >= size or start > end:
            response = HttpResponse(status=416)
            response["Content-Range"] = f"bytes */{size}"
            return response
        length = end - start + 1
        from django.http import StreamingHttpResponse

        response = StreamingHttpResponse(
            _iter_file(full_path, start, length), status=206, content_type=content_type
        )
        response["Content-Length"] = str(length)
        response["Content-Range"] = f"bytes {start}-{end}/{size}"
    else:
        response = FileResponse(open(full_path, "rb"), content_type=content_type)
        response["Content-Length"] = str(size)

    response["Accept-Ranges"] = "bytes"
    response["Cache-Control"] = "public, max-age=86400"
    return response
