import Dexie, { type Table } from 'dexie';
import type { ChartColor } from '@/theme/theme';

/** data-model.md §1 */
export interface User {
  id?: number;
  name: string;
  username: string | null;
  createdAt: string;
}

export type Frequency = 'daily' | 'weekly' | 'custom';
export type DifficultyLevel = 1 | 2 | 3;

/** data-model.md §2 */
export interface Habit {
  id?: number;
  userId: number;
  name: string;
  frequency: Frequency;
  difficultyLevel: DifficultyLevel;
  momentumScore: number;
  timeConstraint: string | null; // 'HH:mm', local
  categoryTag: string | null;
  chartColor: ChartColor;
  createdAt: string;
  archivedAt: string | null;
}

export type ContextTag = 'home' | 'work' | 'gym' | 'other';
export type MoodTag = 1 | 2 | 3 | 4 | 5;

/** data-model.md §3 — one row per day a habit is acted on. */
export interface HabitLog {
  id?: number;
  habitId: number;
  date: string; // YYYY-MM-DD, local
  completed: 0 | 1;
  moodTag: MoodTag | null;
  contextTag: ContextTag | null;
  notes: string | null;
  loggedAt: string;
}

/** data-model.md §5 */
export interface HabitChain {
  id?: number;
  userId: number;
  chainName: string;
  createdAt: string;
}

export interface ChainHabit {
  chainId: number;
  habitId: number;
  orderIndex: number;
}

/** data-model.md §7 */
export interface PomodoroSession {
  id?: number;
  userId: number;
  habitId: number | null;
  startTime: string;
  endTime: string | null;
  durationMinutes: number;
  completed: 0 | 1;
}

/* ---- data-model.md §8 — Phase 2 entities.
   Backed by SEEDED LOCAL MOCK DATA for this build (PRD.md §6 fallback:
   "Mock/seeded friend data is an acceptable stand-in for the demo").
   No Supabase, no auth, no real sync. ---- */

export interface Friendship {
  id?: number;
  userId: number;
  friendUserId: number;
  status: 'pending' | 'accepted';
  createdAt: string;
}

export interface Challenge {
  id?: number;
  creatorUserId: number;
  challengeName: string;
  goalMetric: string;
  startDate: string;
  endDate: string;
}

export interface ChallengeParticipant {
  challengeId: number;
  userId: number;
  progress: number;
}

/** App-local settings (Settings screen, ui-spec.md §14). Single row, id = 1. */
export interface Settings {
  id?: number;
  notificationsEnabled: 0 | 1;
  reminderTime: string; // 'HH:mm'
}

export class MomentumDB extends Dexie {
  users!: Table<User, number>;
  habits!: Table<Habit, number>;
  habitLogs!: Table<HabitLog, number>;
  chains!: Table<HabitChain, number>;
  chainHabits!: Table<ChainHabit, [number, number]>;
  pomodoroSessions!: Table<PomodoroSession, number>;
  friendships!: Table<Friendship, number>;
  challenges!: Table<Challenge, number>;
  challengeParticipants!: Table<ChallengeParticipant, [number, number]>;
  settings!: Table<Settings, number>;

  constructor() {
    super('momentum');
    // Indexing per data-model.md §9.
    this.version(1).stores({
      users: '++id',
      habits: '++id, userId, archivedAt',
      habitLogs: '++id, habitId, [habitId+date], date',
      chains: '++id, userId',
      chainHabits: '[chainId+habitId], chainId, habitId',
      pomodoroSessions: '++id, userId, habitId, startTime',
      friendships: '++id, userId, friendUserId',
      challenges: '++id, creatorUserId',
      challengeParticipants: '[challengeId+userId], challengeId, userId',
      settings: '++id',
    });
  }
}

export const db = new MomentumDB();
