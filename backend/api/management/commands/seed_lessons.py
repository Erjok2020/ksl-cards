"""Seed the three prototype modules with placeholder sample clips.

Usage:  python manage.py seed_lessons

IMPORTANT: the clips in media/samples/ are generated placeholders, NOT
recordings of KSL signs. Every card created here is flagged is_sample=True
and the app labels it "Sample clip - not a reviewed KSL sign". Replace them
with recordings approved by a Deaf KSL reviewer before any evaluation
(proposal Section 3.9, Gate 2).

The command is safe to run more than once. It never overwrites a card that
already has a real (non-sample) video.
"""

import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import KSLCard, Lesson

# Movement descriptions below were already in the project's original seed
# data; signs without one are left blank until a reviewer writes it.
MODULES = [
    {
        "module": "Module 1: Greetings",
        "title": "Greetings",
        "category": "basics",
        "description": "Basic greeting signs used every day",
        "cards": [
            ("Hello", "Hello, my name is Amina.",
             "Open hand, palm facing out, raised to shoulder height and waved gently side to side."),
            ("Goodbye", "Goodbye, see you tomorrow at school.",
             "Open hand waved from side to side at chest level, palm facing the other person."),
            ("Thank You", "Thank you for helping me with my homework.",
             "Flat hand starts at chin, moves forward and slightly down toward the person you are thanking."),
            ("Please", "Please pass me the book.",
             "Flat hand moves in a circular motion on the chest, clockwise."),
        ],
    },
    {
        "module": "Module 2: Numbers",
        "title": "Numbers 1-10",
        "category": "numbers",
        "description": "Counting from one to ten in KSL",
        "cards": [
            ("One", "I have one brother.", ""),
            ("Two", "There are two cups on the table.",
             "Index and middle fingers extended upward in a V shape."),
            ("Three", "We have three lessons today.", ""),
            ("Four", "Four children are playing football.", ""),
            ("Five", "School starts in five minutes.", ""),
            ("Six", "My sister is six years old.", ""),
            ("Seven", "There are seven days in a week.", ""),
            ("Eight", "Class begins at eight o'clock.", ""),
            ("Nine", "I read nine pages yesterday.", ""),
            ("Ten", "Count your fingers: there are ten.", ""),
        ],
    },
    {
        "module": "Module 3: Family",
        "title": "Family",
        "category": "people",
        "description": "Signs for family members",
        "cards": [
            ("Mother", "My mother cooks breakfast.", ""),
            ("Father", "My father walks me to school.", ""),
            ("Sister", "My sister helps me study.",
             "Index finger moved from cheek downward, then two index fingers brought together."),
            ("Brother", "My brother plays football.",
             "Index finger moved from forehead downward, then two index fingers brought together."),
        ],
    },
]


def slug(word):
    return word.lower().replace(" ", "-")


def ensure_sample_files():
    """The sample clips ship with the code in backend/media/samples. When
    uploads live somewhere else (e.g. a Railway volume set with
    DJANGO_MEDIA_ROOT), copy any missing sample files there. Returns the
    number of files copied."""
    source = Path(settings.BASE_DIR) / "media" / "samples"
    target = Path(settings.MEDIA_ROOT) / "samples"
    if not source.is_dir() or source.resolve() == target.resolve():
        return 0
    target.mkdir(parents=True, exist_ok=True)
    copied = 0
    for f in source.iterdir():
        if f.is_file() and not (target / f.name).exists():
            shutil.copy2(f, target / f.name)
            copied += 1
    return copied


class Command(BaseCommand):
    help = "Create the three prototype modules with labelled placeholder sample clips."

    @transaction.atomic
    def handle(self, *args, **options):
        copied = ensure_sample_files()
        if copied:
            self.stdout.write(f"Copied {copied} sample files to {settings.MEDIA_ROOT}/samples.")
        created_cards = updated_cards = skipped = 0

        for module_order, spec in enumerate(MODULES, start=1):
            lesson, _ = Lesson.objects.get_or_create(
                title=spec["title"],
                category=spec["category"],
                defaults={"description": spec["description"]},
            )
            lesson.module = spec["module"]
            lesson.sort_order = module_order
            if not lesson.description:
                lesson.description = spec["description"]
            lesson.save()

            for order, (word, sentence, movement) in enumerate(spec["cards"], start=1):
                matches = KSLCard.objects.filter(lesson=lesson, english_word__iexact=word)
                card = matches.first()
                # Remove duplicates of the same sample sign left by old seeds.
                for dup in matches[1:]:
                    if dup.is_sample:
                        dup.delete()

                if card and card.video and not card.is_sample:
                    skipped += 1  # real recording: never touch it
                    continue

                is_new = card is None
                card = card or KSLCard(lesson=lesson, english_word=word)
                card.context_sentence = card.context_sentence or sentence
                card.movement_description = card.movement_description or movement
                card.video.name = f"samples/{slug(word)}.mp4"
                # Keep a poster or image link the card already had.
                if not card.poster or card.poster.name.startswith("samples/"):
                    card.poster.name = f"samples/{slug(word)}.jpg"
                card.is_sample = True
                card.review_status = KSLCard.ReviewStatus.APPROVED
                card.order = order
                card.save()
                if is_new:
                    created_cards += 1
                else:
                    updated_cards += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(MODULES)} modules: {created_cards} cards created, "
                f"{updated_cards} updated, {skipped} real recordings left untouched."
            )
        )
        self.stdout.write(
            self.style.WARNING(
                "Sample clips are placeholders, not reviewed KSL. Replace them before evaluation."
            )
        )
