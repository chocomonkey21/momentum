import type { HabitLog } from '@/db/schema';
import { todayKey, previousDayKey } from './dates';

type StreakLog = Pick<HabitLog, 'date' | 'completed'> & { skipped?: boolean };

/**
 * data-model.md §4.2 — `currentStreak` is a DISPLAY metric, derived, and
 * deliberately distinct from momentumScore. Count of consecutive most-recent
 * days with completed = 1, walking backward, breaking on the first missed day.
 *
 * A `skipped` day is transparent: it doesn't add to the count, but it also
 * doesn't break the run — walking continues past it to the day before.
 */
export function currentStreak(logs: StreakLog[], today: string = todayKey()): number {
  const ordered = [...logs]
    .filter((l) => l.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));
  let count = 0;
  let expected: string | null = null;
  for (const log of ordered) {
    if (expected !== null && log.date !== expected) break; // a gap ends the streak
    if (log.skipped) {
      expected = previousDayKey(log.date);
      continue;
    }
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

/**
 * Completion rate over a set of logs, 0–100. An intentionally skipped day is
 * excused rather than counted against consistency — it's dropped from both
 * the numerator and the denominator, not just the numerator, so a week of
 * legitimate skips doesn't read as a bad completion rate. Returns 0 for an
 * empty (or all-skipped) set.
 */
export function completionRate(logs: (Pick<HabitLog, 'completed'> & { skipped?: boolean })[]): number {
  const counted = logs.filter((l) => !l.skipped);
  if (counted.length === 0) return 0;
  return Math.round((totalCompletions(counted) / counted.length) * 100);
}
