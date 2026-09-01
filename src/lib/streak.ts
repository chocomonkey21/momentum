import type { HabitLog } from '@/db/schema';
import { todayKey, previousDayKey } from './dates';

/**
 * data-model.md §4.2 — `currentStreak` is a DISPLAY metric, derived, and
 * deliberately distinct from momentumScore. Count of consecutive most-recent
 * days with completed = 1, walking backward, breaking on the first missed day.
 */
export function currentStreak(
  logs: Pick<HabitLog, 'date' | 'completed'>[],
  today: string = todayKey(),
): number {
  const ordered = [...logs]
    .filter((l) => l.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));
  let count = 0;
  let expected: string | null = null;
  for (const log of ordered) {
    if (expected !== null && log.date !== expected) break; // a gap ends the streak
    if (log.completed !== 1) break;
    count += 1;
    expected = previousDayKey(log.date);
  }
  return count;
}

/** Lifetime completion count, used on Profile and in achievements. */
export function totalCompletions(logs: Pick<HabitLog, 'completed'>[]): number {
  return logs.reduce((n, l) => n + (l.completed === 1 ? 1 : 0), 0);
}

/** Completion rate over a set of logs, 0–100. Returns 0 for an empty set. */
export function completionRate(logs: Pick<HabitLog, 'completed'>[]): number {
  if (logs.length === 0) return 0;
  return Math.round((totalCompletions(logs) / logs.length) * 100);
}
