export interface User {
  id: number;
  username: string;
}

export interface Lesson {
  id: number;
  title: string;
  category: string;
  description?: string;
  card_count: number;
  color?: string;
}

export interface LessonCard extends Lesson {
  color: string;
}

export interface Card {
  id: number;
  meaning: string;
  description: string;
  image_url?: string;
}

export interface PendingProgressItem {
  lesson_id: number;
  completion: boolean;
  saved_at: number;
}

export interface AuthResponse {
  token?: string;
  user?: User;
  error?: string;
}

export interface LoginProps {
  onLogin: (user: User, isNewUser: boolean) => void;
}

export interface DashboardProps {
  user: User;
  isNewUser: boolean;
  onSelectLesson: (lesson: LessonCard) => void;
  onLogout: () => void;
}

export interface CardViewerProps {
  lesson: LessonCard;
  onBack: () => void;
}
