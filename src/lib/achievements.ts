import type { HabitLog } from '@/db/schema';
import { totalCompletions } from './streak';

/**
 * Achievements (ui-spec.md §13 / design-system.md §7).
 *
 * Locked badges are always shown with their criteria — a mystery grey icon is
 * less motivating than a visible target, and the Product Philosophy is about
 * showing what's reachable rather than hiding it.
 *
 * Derived, never stored, so they can never drift from the underlying logs.
 */
export interface Achievement {
  id: string;
  name: string;
  criteria: string;
  unlocked: boolean;
  /** 0–1, for the "how close am I" hint on a locked badge. */
  progress: number;
}

export function computeAchievements(input: {
  logs: HabitLog[];
  bestStreak: number;
  habitCount: number;
  bestMomentum: number;
  focusSessions: number;
}): Achievement[] {
  const completions = totalCompletions(input.logs);

  const make = (
    id: string,
    name: string,
    criteria: string,
    value: number,
    target: number,
  ): Achievement => ({
    id,
    name,
    criteria,
    unlocked: value >= target,
    progress: Math.max(0, Math.min(1, target === 0 ? 0 : value / target)),
  });

  return [
    make('first-step', 'First Step', 'Log your first completion', completions, 1),
    make('ten-down', 'Ten Down', 'Complete habits 10 times', completions, 10),
    make('half-century', 'Half Century', 'Complete habits 50 times', completions, 50),
    make('week-strong', 'Week Strong', 'Hold a 7-day streak', input.bestStreak, 7),
    make('fortnight', 'Fortnight', 'Hold a 14-day streak', input.bestStreak, 14),
    make('high-momentum', 'In the Groove', 'Push a habit past 70 momentum', input.bestMomentum, 70),
    make('maxed', 'Full Tilt', 'Reach 100 momentum on any habit', input.bestMomentum, 100),
    make('stacked', 'Stacked', 'Track 3 habits at once', input.habitCount, 3),
    make('focused', 'Deep Work', 'Finish 5 focus sessions', input.focusSessions, 5),
  ];
}

/** Best streak ever achieved for a habit, walking its full history. */
export function bestStreakEver(logs: Pick<HabitLog, 'date' | 'completed'>[]): number {
  const ordered = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  let best = 0;
  let run = 0;
  for (const log of ordered) {
    if (log.completed === 1) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}
