export type Role = "learner" | "teacher" | "reviewer" | "admin";

export interface User {
  id: number;
  username: string;
  role: Role;
  must_change_password?: boolean;
}

export interface AuthResponse {
  access?: string;
  refresh?: string;
  user?: User;
  error?: string;
}

export interface Lesson {
  id: number;
  title: string;
  module: string;
  category: string;
  description?: string;
  sort_order: number;
  card_count: number;
  /** Signs with a real recording approved by a Deaf KSL reviewer. */
  reviewed_count: number;
  download_size_kb: number;
}

export interface Card {
  id: number;
  lesson_id: number;
  english_word: string;
  context_sentence: string;
  movement_description: string;
  kiswahili: string;
  /** True only for a real recording approved by a Deaf KSL reviewer. */
  reviewed: boolean;
  video_url: string;
  poster_url: string;
  file_size_kb: number;
  is_sample: boolean;
  order: number;
}

export type ReviewStatus = "pending" | "approved" | "rejected";
export type Decision = "approved" | "revise" | "rejected";

export interface ManagedCard extends Card {
  lesson_title: string;
  review_status: ReviewStatus;
  uploaded_by: string | null;
  last_review: {
    decision: Decision;
    notes: string;
    reviewer: string | null;
    reviewed_at: string;
  } | null;
}

export interface ManagedLesson extends Lesson {
  total_cards: number;
}

export interface ProgressRecord {
  lesson_id: number;
  lesson: string;
  module: string;
  completed_cards: number;
  card_count: number;
  completed: boolean;
  updated_at: string;
}

export interface ProgressEvent {
  client_event_id: string;
  lesson_id: number;
  completed_cards: number;
  completed: boolean;
}

export interface QueuedProgressEvent extends ProgressEvent {
  user_id: number;
  created_at: number;
}

export interface DownloadRecord {
  module: string;
  lessonIds: number[];
  urls: string[];
  sizeKb: number;
  downloadedAt: number;
}

export interface Module {
  name: string;
  lessons: Lesson[];
  sizeKb: number;
}

export interface FaqEntry {
  id: number;
  category: string;
  category_label: string;
  question: string;
  answer: string;
  slug: string;
}

export interface PolicyPageData {
  slug: string;
  title: string;
  body: string;
  is_draft: boolean;
  updated_at: string;
}

export interface QuizAnswer {
  card_id: number;
  chosen_card_id: number;
  correct: boolean;
}

export interface QuizAttempt {
  client_event_id: string;
  lesson_id: number;
  score: number;
  total: number;
  answers: QuizAnswer[];
  completed_at: string;
}

export interface QueuedQuizAttempt extends QuizAttempt {
  user_id: number;
}

/** Best and latest lesson-check result for one lesson. */
export interface QuizSummary {
  attempts: number;
  best: { score: number; total: number };
  last: { score: number; total: number };
  passed: boolean;
  /** True while the newest result is still waiting to sync. */
  pending: boolean;
}
