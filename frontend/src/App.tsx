import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Button, { ButtonLink } from "./components/ui/Button";
import PageShell, { type Crumb } from "./components/ui/PageShell";
import { ErrorMessage, Skeleton } from "./components/ui/primitives";
import { API_CACHE, clearSession, getSavedUser, SESSION_EXPIRED } from "./lib/api";
import { useEventVersion, useOnline } from "./lib/hooks";
import { pendingEvents, PROGRESS_CHANGED, syncProgress } from "./lib/progress";
import { pendingQuizAttempts, QUIZ_CHANGED, syncQuizAttempts } from "./lib/quiz";
import { matchPath, navigate, usePath } from "./lib/router";
import { COURSE_NAME, useCourse, type Course } from "./lib/useCourse";
import { usePageMeta } from "./lib/usePageMeta";
import Account from "./pages/Account";
import CourseHome, { CourseBanner } from "./pages/CourseHome";
import Downloads from "./pages/Downloads";
import Faq from "./pages/Faq";
import Feedback from "./pages/Feedback";
import LessonCheck from "./pages/LessonCheck";
import LessonView from "./pages/LessonView";
import Login from "./pages/Login";
import Manage from "./pages/Manage";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import Progress from "./pages/Progress";
import Thanks from "./pages/Thanks";
import type { User } from "./types";

/** Pages that can be read without signing in. */
const PUBLIC_PATHS = ["/faq", "/privacy", "/feedback", "/thank-you"];

const HOME: Crumb = { label: "Lessons", to: "/" };

function Meta({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  usePageMeta(title, description);
  return <>{children}</>;
}

interface Route {
  page: ReactNode;
  banner?: ReactNode;
  breadcrumbs?: Crumb[];
  /** The page lays out its own full-width columns. */
  bare?: boolean;
}

/** /lesson/:id and /lesson/:id/check, found in the real course data. */
function lessonRoute(user: User, course: Course, id: string, kind: "signs" | "check"): Route {
  if (course.status === "loading") {
    return { page: <Skeleton label="Loading lesson" lines={3} /> };
  }
  const lesson = course.lessons.find((l) => String(l.id) === id);
  const module = course.modules.find((m) => m.lessons.some((l) => String(l.id) === id));
  if (course.status === "error" && !lesson) {
    return {
      page: (
        <ErrorMessage title="We couldn't load this lesson" onRetry={course.reload}>
          {course.error}
        </ErrorMessage>
      ),
    };
  }
  if (!lesson || !module) return { page: <NotFound />, breadcrumbs: [HOME, { label: "Page not found" }] };
  return {
    bare: true,
    page:
      kind === "check" ? (
        <LessonCheck user={user} lesson={lesson} module={module} course={course} />
      ) : (
        <LessonView user={user} lesson={lesson} module={module} course={course} />
      ),
  };
}

function SignedInApp({
  user,
  isNewUser,
  onChanged,
  onLogout,
}: {
  user: User;
  isNewUser: boolean;
  onChanged: (u: User) => void;
  onLogout: () => void;
}) {
  const path = usePath();
  const online = useOnline();
  const course = useCourse(user.id);
  const progressVersion = useEventVersion(PROGRESS_CHANGED);
  const quizVersion = useEventVersion(QUIZ_CHANGED);
  const [pendingSync, setPendingSync] = useState(0);

  // Send anything queued on this device when the app opens and whenever the
  // connection comes back. Both endpoints ignore events they've already seen.
  useEffect(() => {
    if (!online) return;
    void syncProgress(user.id);
    void syncQuizAttempts(user.id);
  }, [user.id, online]);

  useEffect(() => {
    let active = true;
    Promise.all([pendingEvents(user.id), pendingQuizAttempts(user.id)])
      .then(([p, q]) => active && setPendingSync(p.length + q.length))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user.id, progressVersion, quizVersion]);

  const mustChangePassword = !!user.must_change_password;
  const lessonMatch = matchPath("/lesson/:id", path);
  const checkMatch = matchPath("/lesson/:id/check", path);
  let route: Route;

  if (mustChangePassword) {
    route = {
      page: (
        <Meta title="Choose a new password" description="Choose a new password to continue using KSL Cards.">
          <Account user={user} forced onChanged={onChanged} />
        </Meta>
      ),
    };
  } else if (path === "/" || path === "/login") {
    route = {
      bare: true,
      banner: <CourseBanner course={course} pendingSync={pendingSync} />,
      page: (
        <Meta
          title={COURSE_NAME}
          description="Learn everyday Kenyan Sign Language in modules of sign videos. Track your progress and save modules to use offline."
        >
          {isNewUser && (
            <p role="status" className="sr-only">
              Welcome to KSL Cards, {user.username}.
            </p>
          )}
          <CourseHome course={course} />
        </Meta>
      ),
    };
  } else if (lessonMatch && /^\d+$/.test(lessonMatch.id)) {
    route = lessonRoute(user, course, lessonMatch.id, "signs");
  } else if (checkMatch && /^\d+$/.test(checkMatch.id)) {
    route = lessonRoute(user, course, checkMatch.id, "check");
  } else if (path === "/progress") {
    route = { page: <Progress course={course} pendingSync={pendingSync} />, breadcrumbs: [HOME, { label: "My Progress" }] };
  } else if (path === "/downloads") {
    route = { page: <Downloads course={course} />, breadcrumbs: [HOME, { label: "Downloads" }] };
  } else if (path === "/account") {
    route = {
      page: (
        <Meta title="Account" description="Change your KSL Cards password and manage your account.">
          <Account user={user} forced={false} onChanged={onChanged} />
        </Meta>
      ),
      breadcrumbs: [HOME, { label: "Account" }],
    };
  } else if (path === "/manage" && user.role !== "learner") {
    const title = user.role === "reviewer" ? "Review signs" : "Manage content";
    route = {
      page: (
        <Meta title={title} description="Upload sign videos, review signs and manage KSL Cards accounts.">
          <Manage user={user} />
        </Meta>
      ),
      breadcrumbs: [HOME, { label: title }],
    };
  } else if (path === "/manage") {
    // Learners: the page exists but isn't for their role. Say so plainly
    // rather than showing "page not found".
    route = {
      page: (
        <Meta title="Staff only" description="Uploading and reviewing signs is for teachers, reviewers and administrators.">
          <div className="mx-auto max-w-[640px] py-6">
            <p className="eyebrow">Staff only</p>
            <h1 className="mt-1 text-h1">This page is for teachers, reviewers and administrators</h1>
            <p className="mt-2 text-body text-muted">
              You're signed in as <strong className="font-semibold text-ink">{user.username}</strong>, a learner
              account. To upload or review signs, sign out and sign in with a teacher, reviewer or administrator
              account, or ask an administrator to change your role.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <ButtonLink to="/" variant="primary">
                Go to Lessons
              </ButtonLink>
              <Button variant="secondary" onClick={onLogout}>
                Sign out
              </Button>
            </div>
          </div>
        </Meta>
      ),
      breadcrumbs: [HOME, { label: "Staff only" }],
    };
  } else if (path === "/faq") {
    route = { page: <Faq />, breadcrumbs: [HOME, { label: "FAQ" }] };
  } else if (path === "/privacy") {
    route = { page: <Privacy />, breadcrumbs: [HOME, { label: "Privacy policy" }] };
  } else if (path === "/feedback") {
    route = { page: <Feedback user={user} />, breadcrumbs: [HOME, { label: "Send feedback" }] };
  } else if (path === "/thank-you") {
    route = { page: <Thanks />, breadcrumbs: [HOME, { label: "Thank you" }] };
  } else {
    route = { page: <NotFound />, breadcrumbs: [HOME, { label: "Page not found" }] };
  }

  return (
    <PageShell
      user={user}
      locked={mustChangePassword}
      onLogout={onLogout}
      pendingSync={pendingSync}
      banner={route.banner}
      breadcrumbs={route.breadcrumbs}
      bare={route.bare}
    >
      {route.page}
    </PageShell>
  );
}

/** FAQ, privacy, feedback and thank-you work without an account. */
function PublicApp({ path }: { path: string }) {
  const crumbs: Crumb[] = [{ label: "Sign in", to: "/login" }];
  const page =
    path === "/faq" ? (
      <Faq />
    ) : path === "/privacy" ? (
      <Privacy />
    ) : path === "/feedback" ? (
      <Feedback user={null} />
    ) : (
      <Thanks />
    );
  const label = { "/faq": "FAQ", "/privacy": "Privacy policy", "/feedback": "Send feedback" }[path] ?? "Thank you";
  return (
    <PageShell user={null} breadcrumbs={[...crumbs, { label }]}>
      {page}
    </PageShell>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(getSavedUser);
  const [isNewUser, setIsNewUser] = useState(false);
  const [notice, setNotice] = useState("");
  const path = usePath();

  useEffect(() => {
    // Refresh token expired: ask the learner to sign in again. Downloaded
    // lessons and queued progress stay on the device.
    function expired() {
      clearSession();
      setUser(null);
      setNotice("Your session has expired. Please sign in again — your saved lessons and progress are still on this device.");
    }
    // Another tab signed out or signed in as someone else: follow it.
    function otherTabChanged(e: StorageEvent) {
      // "ksl_user" only changes on sign-in or sign-out (null = storage cleared).
      if (e.key !== null && e.key !== "ksl_user") return;
      const saved = getSavedUser();
      setUser(saved);
      setNotice(saved ? "" : "You signed out in another tab.");
    }
    window.addEventListener(SESSION_EXPIRED, expired);
    window.addEventListener("storage", otherTabChanged);
    return () => {
      window.removeEventListener(SESSION_EXPIRED, expired);
      window.removeEventListener("storage", otherTabChanged);
    };
  }, []);

  function handleLogin(u: User, newUser: boolean) {
    setUser(u);
    setIsNewUser(newUser);
    setNotice("");
    if (path === "/login") navigate("/", { replace: true });
  }

  async function handleLogout() {
    clearSession();
    // Lesson text cached for this account; downloaded videos are kept.
    await caches?.delete(API_CACHE).catch(() => undefined);
    setUser(null);
    navigate("/");
  }

  if (!user) {
    if (PUBLIC_PATHS.includes(path)) return <PublicApp path={path} />;
    // Everything else asks for sign-in, keeping the URL so the learner lands
    // on the page they asked for.
    return (
      <Meta
        title="Sign in"
        description="Sign in to KSL Cards to learn Kenyan Sign Language with sign videos that also work offline."
      >
        <Login onLogin={handleLogin} notice={notice} />
      </Meta>
    );
  }

  return (
    <SignedInApp
      key={user.id}
      user={user}
      isNewUser={isNewUser}
      onChanged={setUser}
      onLogout={() => void handleLogout()}
    />
  );
}
