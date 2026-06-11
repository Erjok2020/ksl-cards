from django.contrib.auth.models import User
from django.contrib.auth        import authenticate

from rest_framework              import status
from rest_framework.decorators   import api_view, permission_classes
from rest_framework.permissions  import IsAuthenticated, AllowAny
from rest_framework.response     import Response
from rest_framework.authtoken.models import Token

from .models import Lesson, KSLCard, Progress


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    username = request.data.get("username", "").strip()
    password = request.data.get("password", "")

    if not username or not password:
        return Response(
            {"error": "Username and password are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if User.objects.filter(username=username).exists():
        return Response(
            {"error": "That username is already taken."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user  = User.objects.create_user(username=username, password=password)
    token = Token.objects.create(user=user)

    return Response({
        "token": token.key,
        "user":  {"id": user.id, "username": user.username},
    }, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    username = request.data.get("username", "")
    password = request.data.get("password", "")

    user = authenticate(username=username, password=password)
    if not user:
        return Response(
            {"error": "Wrong username or password."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    token, _ = Token.objects.get_or_create(user=user)

    return Response({
        "token": token.key,
        "user":  {"id": user.id, "username": user.username},
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def lesson_list(request):
    lessons = Lesson.objects.all()
    data = [
        {
            "id":          l.id,
            "title":       l.title,
            "category":    l.category,
            "description": l.description,
            "card_count":  l.card_count(),
        }
        for l in lessons
    ]
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def lesson_cards(request, lesson_id):
    try:
        lesson = Lesson.objects.get(id=lesson_id)
    except Lesson.DoesNotExist:
        return Response({"error": "Lesson not found."}, status=404)

    cards = KSLCard.objects.filter(lesson=lesson)
    data  = [
        {
            "id":          c.id,
            "meaning":     c.meaning,
            "description": c.description,
            "image_url":   c.image_url,
        }
        for c in cards
    ]
    return Response(data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def save_progress(request):
    lesson_id  = request.data.get("lesson_id")
    completion = request.data.get("completion", False)

    try:
        lesson = Lesson.objects.get(id=lesson_id)
    except Lesson.DoesNotExist:
        return Response({"error": "Lesson not found."}, status=404)

    progress, created = Progress.objects.update_or_create(
        user=request.user,
        lesson=lesson,
        defaults={"completion": completion},
    )

    return Response({
        "lesson_id":  lesson.id,
        "completion": progress.completion,
        "updated_at": progress.updated_at,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_progress(request):
    records = Progress.objects.filter(user=request.user)
    data = [
        {
            "lesson_id":  p.lesson.id,
            "lesson":     p.lesson.title,
            "completion": p.completion,
            "updated_at": p.updated_at,
        }
        for p in records
    ]
    return Response(data)