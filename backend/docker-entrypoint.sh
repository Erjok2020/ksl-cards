#!/bin/sh
set -e

# Wait for the database, apply migrations, optionally seed, then start.
python - <<'EOF'
import os, sys, time
if os.getenv("DJANGO_DB_ENGINE") != "mysql":
    sys.exit(0)
import MySQLdb
for attempt in range(60):
    try:
        MySQLdb.connect(
            host=os.getenv("DJANGO_DB_HOST", "db"),
            port=int(os.getenv("DJANGO_DB_PORT", "3306")),
            user=os.getenv("DJANGO_DB_USER", "root"),
            passwd=os.getenv("DJANGO_DB_PASSWORD", ""),
            db=os.getenv("DJANGO_DB_NAME", "ksl_cards"),
        ).close()
        break
    except MySQLdb.OperationalError:
        print("Waiting for MySQL...", flush=True)
        time.sleep(2)
else:
    sys.exit("MySQL did not become available")
EOF

python manage.py migrate --noinput
# Starter FAQ and draft privacy policy (never overwrites edits made in the admin).
python manage.py seed_content --if-new

# The three sample modules are added once. After that, sample signs removed in
# the admin stay removed. Set SEED_SAMPLE_LESSONS=false to never add them.
if [ "${SEED_SAMPLE_LESSONS:-true}" != "false" ]; then
    python manage.py seed_lessons --if-new
fi

exec "$@"
