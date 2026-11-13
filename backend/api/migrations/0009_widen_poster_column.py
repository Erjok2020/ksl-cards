"""Widen the poster column to 300 characters on MySQL.

0006 first created this column with 100 characters; it now uses 300 so old
image links are never cut short. A database migrated before that change
keeps the shorter column, so widen it here. Widening never loses data, and
it has no effect where the column is already 300 characters. SQLite does
not enforce the length, so nothing is needed there.
"""

from django.db import migrations


def widen_poster(apps, schema_editor):
    if schema_editor.connection.vendor == "mysql":
        schema_editor.execute("ALTER TABLE api_kslcard MODIFY poster varchar(300) NOT NULL")


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0008_content_feedback_quiz"),
    ]

    operations = [
        migrations.RunPython(widen_poster, migrations.RunPython.noop),
    ]
