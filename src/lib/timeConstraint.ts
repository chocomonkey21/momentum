import { nowHHmm } from './dates';

/**
 * Time-constrained habits, v2.
 *
 * The original model was deadline-only and BLOCKED completion once the
 * deadline passed. That's been reversed: a completion after the window is
 * now allowed, just flagged "late" — the habit still counts toward the
 * streak, which is the whole point of tracking lateness instead of hiding
 * behind a lockout. `windowEnd` (the `timeConstraint` column) alone keeps
 * the original single-deadline shape; pairing it with `windowStart` makes
 * it a true start/end window (e.g. "meditate 10–11am").
 */

/** True when `time` (HH:mm) falls inside the window. No windowEnd = unconstrained. */
export function isWithinWindow(
  windowStart: string | null,
  windowEnd: string | null,
  time: string,
): boolean {
  if (!windowEnd) return true;
  if (windowStart && time < windowStart) return false;
  return time <= windowEnd;
}

/**
 * On-time-ness for a completion happening right now.
 * null = the habit has no window at all, so the concept doesn't apply —
 * distinct from `false`, which means "has a window, missed it."
 */
export function isOnTime(
  windowStart: string | null,
  windowEnd: string | null,
  now: Date = new Date(),
): boolean | null {
  if (!windowEnd) return null;
  return isWithinWindow(windowStart, windowEnd, nowHHmm(now));
}

/**
 * Informational only, post-lockout: true once the window has closed today
 * and the habit isn't done yet. Used to show a "late" affordance — it no
 * longer disables anything.
 */
export function isPastWindow(windowEnd: string | null, now: Date = new Date()): boolean {
  if (!windowEnd) return false;
  return nowHHmm(now) > windowEnd;
}

/** Minutes until the window closes; null when unconstrained or already past. */
export function minutesUntilWindowClose(
  windowEnd: string | null,
  now: Date = new Date(),
): number | null {
  if (!windowEnd) return null;
  const [h, m] = windowEnd.split(':').map(Number);
  const close = new Date(now);
  close.setHours(h, m, 0, 0);
  const diff = Math.round((close.getTime() - now.getTime()) / 60000);
  return diff >= 0 ? diff : null;
}

/** True when the window is closing soon enough to warrant a nudge. */
export function isWindowClosingSoon(windowEnd: string | null, now: Date = new Date()): boolean {
  const mins = minutesUntilWindowClose(windowEnd, now);
  return mins !== null && mins <= 30;
}

/** 'Xh Ym left' / 'Ym left', for the countdown affordance. */
export function formatCountdown(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h left` : `${h}h ${m}m left`;
  }
  return `${Math.max(0, minutes)}m left`;
}
