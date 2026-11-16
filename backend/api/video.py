"""Compress uploaded sign videos.

Teachers upload recordings straight from a phone, which are far larger than a
learner on a slow or costly connection should have to download. Each upload is
re-encoded with ffmpeg to a small H.264 MP4: at most 720 pixels tall, no audio
(signs play muted) and ready to start playing before it has fully downloaded.

If ffmpeg is missing or cannot read the file, the caller keeps the original.
"""

import os
import shutil
import subprocess
import tempfile

from django.core.files.base import ContentFile

# Leaves room inside the 120 second request limit (gunicorn --timeout).
TIMEOUT_SECONDS = 90


def compress_video(upload):
    """Return the compressed video as a ContentFile, or None when it could not
    be compressed or the result is not smaller than the upload."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return None
    workdir = tempfile.mkdtemp(prefix="ksl-video-")
    try:
        source = os.path.join(workdir, "source")
        target = os.path.join(workdir, "target.mp4")
        upload.seek(0)
        with open(source, "wb") as f:
            for chunk in upload.chunks():
                f.write(chunk)
        result = subprocess.run(
            [
                ffmpeg, "-nostdin", "-loglevel", "error", "-y",
                "-i", source,
                "-vf", "scale=-2:'min(720,ih)'",
                "-c:v", "libx264", "-crf", "28", "-preset", "fast",
                "-pix_fmt", "yuv420p",
                "-an",
                "-movflags", "+faststart",
                target,
            ],
            capture_output=True,
            timeout=TIMEOUT_SECONDS,
        )
        if result.returncode != 0 or not os.path.isfile(target):
            return None
        size = os.path.getsize(target)
        if size == 0 or size >= upload.size:
            return None
        with open(target, "rb") as f:
            return ContentFile(f.read())
    except (OSError, subprocess.SubprocessError):
        return None
    finally:
        upload.seek(0)
        shutil.rmtree(workdir, ignore_errors=True)
