import { nowHHmm } from './dates';

/**
 * data-model.md §4.3 — a per-habit deadline blocks logging as COMPLETED after
 * the given local time. The habit stays visible; only the completed path locks.
 */
export function canLogToday(timeConstraint: string | null, now: Date = new Date()): boolean {
  if (!timeConstraint) return true;
  return nowHHmm(now) <= timeConstraint;
}

/** Minutes remaining before a habit's deadline; null when unconstrained. */
export function minutesUntilDeadline(
  timeConstraint: string | null,
  now: Date = new Date(),
): number | null {
  if (!timeConstraint) return null;
  const [h, m] = timeConstraint.split(':').map(Number);
  const deadline = new Date(now);
  deadline.setHours(h, m, 0, 0);
  return Math.round((deadline.getTime() - now.getTime()) / 60000);
}

/** True when the deadline is close enough to warrant a `color.warning` affordance. */
export function isApproachingDeadline(
  timeConstraint: string | null,
  now: Date = new Date(),
): boolean {
  const mins = minutesUntilDeadline(timeConstraint, now);
  return mins !== null && mins > 0 && mins <= 120;
}
