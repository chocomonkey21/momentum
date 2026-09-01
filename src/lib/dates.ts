import { format, parseISO, startOfDay, differenceInCalendarDays, addDays } from 'date-fns';

/**
 * data-model.md §0 — a "day" boundary is the DEVICE'S LOCAL MIDNIGHT, not UTC.
 * All day-level values are 'YYYY-MM-DD' strings in local time; all timestamps
 * are full ISO datetimes.
 */

export function toDayKey(d: Date = new Date()): string {
  return format(startOfDay(d), 'yyyy-MM-dd');
}

export function todayKey(): string {
  return toDayKey(new Date());
}

export function yesterdayKey(): string {
  return toDayKey(addDays(new Date(), -1));
}

export function dayKeyToDate(key: string): Date {
  // parseISO on a bare date string yields local midnight, which is what we want.
  return parseISO(key);
}

export function daysBetween(aKey: string, bKey: string): number {
  return differenceInCalendarDays(dayKeyToDate(bKey), dayKeyToDate(aKey));
}

/** Inclusive range of day keys from `fromKey` to `toKey`. */
export function dayKeyRange(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  const n = daysBetween(fromKey, toKey);
  if (n < 0) return out;
  const start = dayKeyToDate(fromKey);
  for (let i = 0; i <= n; i++) out.push(toDayKey(addDays(start, i)));
  return out;
}

/** Current local time as 'HH:mm', for time-constraint comparison. */
export function nowHHmm(d: Date = new Date()): string {
  return format(d, 'HH:mm');
}

export function isValidHHmm(v: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/** '18:30' -> '6:30 PM', for user-facing copy. */
export function formatHHmm(v: string): string {
  if (!isValidHHmm(v)) return v;
  const [h, m] = v.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function longDate(d: Date = new Date()): string {
  return format(d, 'EEEE, MMMM d');
}
