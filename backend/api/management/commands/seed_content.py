"""Create the starter FAQ entries and the draft privacy policy.

Usage:  python manage.py seed_content

Safe to run more than once: it only creates what is missing and never
overwrites text that was edited in the admin.

Every statement here describes what the app really does or stores. If the
models change, update the privacy text. The privacy policy is created as a
DRAFT and must be reviewed by the supervisor and the ethics process.
"""

from django.core.management.base import BaseCommand

from api.models import FAQEntry, PolicyPage

FAQ = [
    # (category, slug, question, answer)
    (
        "learning",
        "signers",
        "Who records the signs?",
        "Each sign is meant to be recorded by a Deaf signer who uses Kenyan Sign Language, and then "
        "checked by a second Deaf KSL reviewer before learners see it. Signs marked \"Sample clip\" are "
        "placeholders: they are not KSL signs and have not been reviewed. They will be replaced by "
        "reviewed recordings.",
    ),
    (
        "learning",
        "why-ksl",
        "Why Kenyan Sign Language?",
        "KSL is its own language and the main sign language taught in the Deaf units in Kakuma. Other "
        "sign languages are used in the camp too, but these lessons teach KSL only.",
    ),
    (
        "learning",
        "practise",
        "How should I practise?",
        "Watch a sign at normal speed, then again at 0.5×, then copy it with your own hands. Come back "
        "the next day and try it again before you watch.",
    ),
    (
        "learning",
        "lesson-check",
        "How does the lesson check work?",
        "Each lesson ends with a lesson check. You watch a sign and choose the word it matches. There is "
        "no timer, and you can replay or slow down the video. At the end you see your score and the signs "
        "you missed, with links back to their videos. You can try again as many times as you like. A "
        "check counts as passed when you get at least 75% right. It works offline once the module is "
        "downloaded.",
    ),
    (
        "offline",
        "offline",
        "How do I use lessons without internet?",
        "While you are connected, open Lessons and choose Download on a module. When the module shows "
        "\"Saved offline\", its videos play with no connection. Open the app in the same browser you "
        "used to download.",
    ),
    (
        "offline",
        "space",
        "How much space does a module use?",
        "Each module shows its download size before you download it. The Downloads page shows how much "
        "space saved lessons use, and you can remove a module at any time.",
    ),
    (
        "offline",
        "offline-progress",
        "Is my progress saved when I'm offline?",
        "Yes. Progress and lesson check results are kept on your device and sent to your account the "
        "next time you are online. Nothing is counted twice.",
    ),
    (
        "offline",
        "removed",
        "Why did a saved module disappear?",
        "Browsers can clear saved files when the device is low on space, or when you clear the "
        "browser's data. The module then shows \"Removed by the browser\". Download it again while you "
        "are connected.",
    ),
    (
        "account",
        "password",
        "I forgot my password",
        "Ask the site administrator to reset it. You will get a temporary password and choose a new one "
        "when you sign in. Passwords cannot be reset by email, because KSL Cards does not ask for your "
        "email address.",
    ),
    (
        "account",
        "roles",
        "What is a teacher or reviewer account?",
        "Teachers upload sign videos. Deaf KSL reviewers approve them. Learners only see approved "
        "lessons. Teachers and reviewers cannot see learners' progress.",
    ),
    (
        "account",
        "who-sees",
        "Who can see my progress?",
        "You, and the project administrator. Your progress and lesson check scores are not shown to "
        "other learners, teachers or reviewers.",
    ),
]

PRIVACY = """> We keep only what is needed to sign you in and save your progress. No ads, no tracking, no camera. Downloaded videos stay on your device.

## What we collect
- Your account: a username, a password (stored only as a secure hash, never as readable text), your role (learner, teacher, reviewer or administrator), the date you joined and the time you last signed in.
- Your learning progress: for each lesson, how many signs you have viewed, whether you finished it, and when this was updated.
- Your lesson check results: the score, which answer you chose for each sign, and when you finished.
- Feedback you send: your message, an optional rating and the page it is about. Your username is attached only if you tick the box asking for it.
- For teachers and reviewers: the sign videos you upload and the review decisions you make.
- We do not ask for your real name, email address, phone number or location. Choose a username that does not show your real name.
- KSL Cards has no advertising, no third-party tracking and no analytics, and never uses your camera or microphone.

## How we use it
- To sign you in and show you your lessons.
- To save your progress so it follows you between devices.
- To fix problems you report through feedback.
- For the research evaluation, only in anonymised, grouped form, and only with your consent.

## What stays on your device
- Lessons you download are stored in your browser so they play offline.
- Progress and lesson check results you make offline wait on your device until they can sync.
- A sign-in token is kept in your browser so you stay signed in.
- You can remove downloaded lessons at any time on the Downloads page. Signing out removes the sign-in token.

## Who can see your data
- You.
- The project administrator, to keep the service running and for the research evaluation.
- Teachers and reviewers cannot see your progress or lesson check scores.
- The company that hosts the server keeps standard technical logs of requests, as all web hosts do.
- We do not sell or share your data with anyone else.

## Who this pilot is for
- This pilot version is for adult participants only.

## Your choices
- Ask to see, correct or delete your account and progress at any time by sending feedback or asking the project administrator.
- We delete research data at the end of the study, as described in the consent form. [confirm with supervisor and ethics approval]

## Contact
- Questions about this policy: use Send feedback, or contact the project team through the study's information sheet.
"""


class Command(BaseCommand):
    help = "Create the starter FAQ entries and the draft privacy policy (never overwrites edits)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--if-new",
            action="store_true",
            help="Only add the starter FAQ when there are no FAQ entries yet, so entries "
            "deleted in the admin don't come back (safe to run on every start).",
        )

    def handle(self, *args, **options):
        created = 0
        position = {}
        faq = [] if options["if_new"] and FAQEntry.objects.exists() else FAQ
        for category, slug, question, answer in faq:
            position[category] = position.get(category, 0) + 1
            _, was_created = FAQEntry.objects.get_or_create(
                slug=slug,
                defaults={
                    "category": category,
                    "question": question,
                    "answer": answer,
                    "order": position[category],
                },
            )
            created += was_created

        _, page_created = PolicyPage.objects.get_or_create(
            slug="privacy",
            defaults={"title": "Privacy policy", "body": PRIVACY, "is_draft": True},
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"FAQ: {created} entries created. Privacy policy: "
                f"{'created as a draft' if page_created else 'already exists, left unchanged'}."
            )
        )
        if page_created:
            self.stdout.write(
                self.style.WARNING(
                    "The privacy policy is a DRAFT. Have it reviewed by your supervisor and the ethics "
                    "process, then untick 'Is draft' in the admin."
                )
            )
