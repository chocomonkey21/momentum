import type { HabitLog } from '@/db/schema';

export type AchievementType =
  | 'first-step'
  | 'consistent'
  | 'dedicated'
  | 'getting-started'
  | 'committed'
  | 'first-focus';

/** Flat reward per achievement — the whole "points" model is this one number. */
export const POINTS_PER_ACHIEVEMENT = 100;

export interface AchievementDefinition {
  id: AchievementType;
  name: string;
  description: string;
  requirement: string;
  target: number;
  unit: string;
}

export interface Achievement extends AchievementDefinition {
  unlocked: boolean;
  progress: number;
  current: number;
  progressLabel: string;
  unlockedAt?: string | null;
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  { id: 'first-step', name: 'FIRST STEP', description: 'Complete your first habit.', requirement: 'Complete your first habit', target: 1, unit: 'completion' },
  { id: 'consistent', name: 'CONSISTENT', description: 'Maintain a 7-day streak.', requirement: 'Maintain a 7-day streak', target: 7, unit: 'days' },
  { id: 'dedicated', name: 'DEDICATED', description: 'Maintain a 30-day streak.', requirement: 'Maintain a 30-day streak', target: 30, unit: 'days' },
  { id: 'getting-started', name: 'GETTING STARTED', description: 'Complete 10 habit instances.', requirement: 'Complete 10 habit instances', target: 10, unit: 'completions' },
  { id: 'committed', name: 'COMMITTED', description: 'Complete 50 habit instances.', requirement: 'Complete 50 habit instances', target: 50, unit: 'completions' },
  { id: 'first-focus', name: 'FIRST FOCUS', description: 'Complete your first Pomodoro session.', requirement: 'Complete your first Pomodoro session', target: 1, unit: 'session' },
];

export function computeAchievements(input: {
  lifetimeHabitCompletions: number;
  currentHabitStreak: number;
  completedFocusSessions: number;
  unlockedTypes?: Partial<Record<AchievementType, string | null>>;
}): Achievement[] {
  const values: Record<AchievementType, number> = {
    'first-step': input.lifetimeHabitCompletions,
    consistent: input.currentHabitStreak,
    dedicated: input.currentHabitStreak,
    'getting-started': input.lifetimeHabitCompletions,
    committed: input.lifetimeHabitCompletions,
    'first-focus': input.completedFocusSessions,
  };

  return ACHIEVEMENT_DEFINITIONS.map((definition) => {
    const current = values[definition.id];
    const persistedAt = input.unlockedTypes?.[definition.id];
    const unlocked = Boolean(persistedAt) || current >= definition.target;
    return {
      ...definition,
      unlocked,
      current,
      progress: Math.max(0, Math.min(1, current / definition.target)),
      progressLabel: `${Math.min(current, definition.target)} / ${definition.target} ${definition.unit}`,
      unlockedAt: persistedAt ?? null,
    };
  });
}

/** Best uninterrupted completed run across a habit's full history. */
export function bestStreakEver(logs: Pick<HabitLog, 'date' | 'completed'>[]): number {
  const ordered = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  let best = 0;
  let run = 0;
  for (const log of ordered) {
    if (log.completed === 1) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}
