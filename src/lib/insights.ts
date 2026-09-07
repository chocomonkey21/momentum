import type { HabitLog, ContextTag } from '@/db/schema';
import { MOOD_LABELS } from '@/theme/theme';
import { dayKeyToDate } from './dates';

/**
 * Context Tagging exists so the app can explain WHY something worked, not just
 * that it did (CLAUDE.md §2). Insight copy always tries to surface a reason.
 *
 * ui-spec.md §6 [ASSUMPTION]: require a minimum of 3 logged days before
 * attempting an insight, so a single data point can't produce a misleadingly
 * confident correlation.
 */
export const MIN_LOGS_FOR_INSIGHT = 3;

const CONTEXT_LABELS: Record<ContextTag, string> = {
  home: 'at home',
  work: 'at work',
  gym: 'at the gym',
  other: 'out and about',
};

type Bucket = { total: number; done: number };

function rate(b: Bucket): number {
  return b.total === 0 ? 0 : b.done / b.total;
}

function tally(map: Map<string, Bucket>, key: string, completed: boolean) {
  const b = map.get(key) ?? { total: 0, done: 0 };
  b.total += 1;
  if (completed) b.done += 1;
  map.set(key, b);
}

function timeBucket(loggedAt: string): string {
  const hour = new Date(loggedAt).getHours();
  if (hour < 12) return 'mornings';
  if (hour < 17) return 'afternoons';
  return 'evenings';
}

/** Best-supported bucket with at least `minTotal` observations. */
function bestOf(map: Map<string, Bucket>, minTotal = 2): { key: string; rate: number } | null {
  let best: { key: string; rate: number } | null = null;
  for (const [key, b] of map) {
    if (b.total < minTotal) continue;
    const r = rate(b);
    if (!best || r > best.rate) best = { key, rate: r };
  }
  return best;
}

/** A single-habit insight sentence, or null when there isn't enough data yet. */
export function habitInsight(habitName: string, logs: HabitLog[]): string | null {
  if (logs.length < MIN_LOGS_FOR_INSIGHT) return null;

  const byContext = new Map<string, Bucket>();
  const byWeekpart = new Map<string, Bucket>();
  const moodOnDone: number[] = [];

  for (const log of logs) {
    const done = log.completed === 1;
    if (log.contextTag) tally(byContext, log.contextTag, done);
    const dow = dayKeyToDate(log.date).getDay();
    tally(byWeekpart, dow === 0 || dow === 6 ? 'weekends' : 'weekdays', done);
    if (done && log.moodTag) moodOnDone.push(log.moodTag);
  }

  const ctx = bestOf(byContext);
  if (ctx && ctx.rate >= 0.6) {
    return `${habitName} sticks best when you're ${CONTEXT_LABELS[ctx.key as ContextTag]} — ${Math.round(
      ctx.rate * 100,
    )}% of those days got done.`;
  }

  const part = bestOf(byWeekpart);
  const other = part?.key === 'weekdays' ? byWeekpart.get('weekends') : byWeekpart.get('weekdays');
  if (part && other && part.rate - rate(other) >= 0.2) {
    return `You're noticeably more consistent with ${habitName} on ${part.key} — ${Math.round(
      part.rate * 100,
    )}% versus ${Math.round(rate(other) * 100)}%.`;
  }

  if (moodOnDone.length >= 2) {
    const avg = Math.round(moodOnDone.reduce((a, b) => a + b, 0) / moodOnDone.length) as 1 | 2 | 3 | 4 | 5;
    return `On days you complete ${habitName}, you mostly log your mood as "${MOOD_LABELS[avg]}".`;
  }

  return `You've logged ${habitName} ${logs.length} times — keep tagging mood and context to unlock sharper patterns.`;
}

/** Cross-habit insight for Statistics (ui-spec.md §11 [ASSUMPTION]). */
export function aggregateInsight(logs: HabitLog[]): string | null {
  if (logs.length < MIN_LOGS_FOR_INSIGHT) return null;

  const byContext = new Map<string, Bucket>();
  const byWeekpart = new Map<string, Bucket>();
  const byTime = new Map<string, Bucket>();
  const moodOnDone: number[] = [];
  for (const log of logs) {
    const done = log.completed === 1;
    if (log.contextTag) tally(byContext, log.contextTag, done);
    const dow = dayKeyToDate(log.date).getDay();
    tally(byWeekpart, dow === 0 || dow === 6 ? 'weekends' : 'weekdays', done);
    tally(byTime, timeBucket(log.loggedAt), done);
    if (done && log.moodTag) moodOnDone.push(log.moodTag);
  }

  const part = bestOf(byWeekpart, 3);
  const ctx = bestOf(byContext, 3);

  if (part && ctx) {
    return `Your habits do best on ${part.key} and when you're ${
      CONTEXT_LABELS[ctx.key as ContextTag]
    } — that pairing carries ${Math.round(Math.max(part.rate, ctx.rate) * 100)}% of your completions.`;
  }
  if (part) {
    return `Your habits do best on ${part.key} — ${Math.round(part.rate * 100)}% completion there.`;
  }
  const time = bestOf(byTime, 3);
  if (time) {
    return `You're most productive in the ${time.key} — ${Math.round(time.rate * 100)}% of those logs were completed. Try scheduling an important habit then.`;
  }
  if (moodOnDone.length >= 3) {
    const avg = moodOnDone.reduce((sum, mood) => sum + mood, 0) / moodOnDone.length;
    return `Your completed habits cluster around a ${avg >= 4 ? 'positive' : 'steady'} mood. Protect that state before starting your next goal.`;
  }
  return 'Keep tagging mood and context on your logs — patterns start showing after a couple of weeks.';
}
