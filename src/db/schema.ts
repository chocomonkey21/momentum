import type { ChartColor } from '@/theme/theme';

/**
 * Domain types.
 *
 * These are unchanged from the Dexie build on purpose: everything in src/lib/
 * (momentum, streak, time-constraint, insights, recap) is written against these
 * shapes, so keeping them identical means the business logic did not have to be
 * touched by the Supabase migration.
 *
 * Postgres columns are snake_case and ids are uuid/bigint; the `Row` types and
 * mappers at the bottom of this file are the only place that difference exists.
 */

export interface User {
  /** uuid — 1:1 with Supabase auth.users. */
  id: string;
  name: string;
  username: string | null;
  createdAt: string;
}

export type Frequency = 'daily' | 'weekly' | 'custom';
export type DifficultyLevel = 1 | 2 | 3;

export interface Habit {
  id?: number;
  userId: string;
  name: string;
  frequency: Frequency;
  difficultyLevel: DifficultyLevel;
  momentumScore: number;
  /** Window END. Alone, it's the original single deadline; paired with
   *  windowStart it becomes a true start/end window. Null = flexible. */
  timeConstraint: string | null;
  /** Window START. Only meaningful alongside timeConstraint. */
  windowStart: string | null;
  categoryTag: string | null;
  chartColor: ChartColor;
  createdAt: string;
  archivedAt: string | null;
  /** Set by "Not now" on the adaptive-difficulty suggestion — hidden until this date. */
  suggestionDismissedUntil: string | null;
  /** Set while the habit is paused: momentum is frozen and nothing accrues. */
  pausedAt: string | null;
}

export type ContextTag = 'home' | 'work' | 'gym' | 'other';
export type MoodTag = 1 | 2 | 3 | 4 | 5;

export interface HabitLog {
  id?: number;
  habitId: number;
  /** YYYY-MM-DD, local. */
  date: string;
  /** Kept as 0/1 rather than boolean so src/lib's existing checks are unchanged. */
  completed: 0 | 1;
  moodTag: MoodTag | null;
  contextTag: ContextTag | null;
  notes: string | null;
  loggedAt: string;
  /** An intentional, user-chosen skip — unlike an ordinary miss, it doesn't
   *  break a streak and is excluded from the consistency rate. */
  skipped: boolean;
  /** Landed inside the habit's time window when logged. Null when the habit
   *  has no window, or the entry was backfilled for a past day. */
  onTime: boolean | null;
}

export interface HabitChain {
  id?: number;
  userId: string;
  chainName: string;
  createdAt: string;
}

export interface ChainHabit {
  chainId: number;
  habitId: number;
  orderIndex: number;
}

export interface PomodoroSession {
  id?: number;
  userId: string;
  habitId: number | null;
  startTime: string;
  endTime: string | null;
  durationMinutes: number;
  completed: 0 | 1;
}

export interface Friendship {
  id?: number;
  userId: string;
  friendUserId: string;
  status: 'pending' | 'accepted';
  createdAt: string;
}

export interface Challenge {
  id?: number;
  creatorUserId: string;
  challengeName: string;
  goalMetric: string;
  startDate: string;
  endDate: string;
}

export interface ChallengeParticipant {
  challengeId: number;
  userId: string;
  progress: number;
}

export interface Settings {
  userId: string;
  notificationsEnabled: 0 | 1;
  reminderTime: string;
}

/* ------------------------------------------------------------------ *
 * Row shapes and mappers — the only snake_case in the codebase.
 * ------------------------------------------------------------------ */

export interface HabitRow {
  id: number;
  user_id: string;
  name: string;
  frequency: Frequency;
  difficulty_level: number;
  momentum_score: number;
  time_constraint: string | null;
  window_start: string | null;
  category_tag: string | null;
  chart_color: string;
  created_at: string;
  archived_at: string | null;
  suggestion_dismissed_until: string | null;
  paused_at: string | null;
}

export interface HabitLogRow {
  id: number;
  habit_id: number;
  date: string;
  completed: boolean;
  mood_tag: number | null;
  context_tag: ContextTag | null;
  notes: string | null;
  logged_at: string;
  skipped: boolean;
  on_time: boolean | null;
}

export interface ChainRow {
  id: number;
  user_id: string;
  chain_name: string;
  created_at: string;
}

export interface ChainHabitRow {
  chain_id: number;
  habit_id: number;
  order_index: number;
}

export interface PomodoroRow {
  id: number;
  user_id: string;
  habit_id: number | null;
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
  completed: boolean;
}

export function toHabit(r: HabitRow): Habit {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    frequency: r.frequency,
    difficultyLevel: r.difficulty_level as DifficultyLevel,
    momentumScore: r.momentum_score,
    timeConstraint: r.time_constraint,
    windowStart: r.window_start ?? null,
    categoryTag: r.category_tag,
    chartColor: r.chart_color as ChartColor,
    createdAt: r.created_at,
    archivedAt: r.archived_at,
    suggestionDismissedUntil: r.suggestion_dismissed_until ?? null,
    // Normalized to a bare YYYY-MM-DD: the column is a timestamptz, but every
    // comparison against it (isDueOn, replayMomentum, momentumSeries) is
    // against a day-key string, and a full ISO timestamp would silently lose
    // string-comparisons against its own pause day (a same-day prefix sorts
    // as "less than" the longer timestamp).
    pausedAt: r.paused_at ? r.paused_at.slice(0, 10) : null,
  };
}

export function toHabitLog(r: HabitLogRow): HabitLog {
  return {
    id: r.id,
    habitId: r.habit_id,
    date: r.date,
    completed: r.completed ? 1 : 0,
    moodTag: (r.mood_tag as MoodTag | null) ?? null,
    contextTag: r.context_tag,
    notes: r.notes,
    loggedAt: r.logged_at,
    skipped: Boolean(r.skipped),
    onTime: r.on_time ?? null,
  };
}

export function toChain(r: ChainRow): HabitChain {
  return { id: r.id, userId: r.user_id, chainName: r.chain_name, createdAt: r.created_at };
}

export function toChainHabit(r: ChainHabitRow): ChainHabit {
  return { chainId: r.chain_id, habitId: r.habit_id, orderIndex: r.order_index };
}

export function toPomodoro(r: PomodoroRow): PomodoroSession {
  return {
    id: r.id,
    userId: r.user_id,
    habitId: r.habit_id,
    startTime: r.start_time,
    endTime: r.end_time,
    durationMinutes: r.duration_minutes,
    completed: r.completed ? 1 : 0,
  };
}
