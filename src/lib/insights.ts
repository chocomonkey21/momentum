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

/**
 * Where completions happen, as a share. Context is only ever tagged on a
 * completed log (a missed day has no location), so a per-context completion
 * RATE is always 100% and says nothing — the share of completions is the
 * honest version of the same question.
 */
function topContextShare(logs: HabitLog[], minTagged = 5): { key: ContextTag; share: number } | null {
  const counts = new Map<ContextTag, number>();
  let tagged = 0;
  for (const l of logs) {
    if (l.completed !== 1 || !l.contextTag) continue;
    tagged += 1;
    counts.set(l.contextTag, (counts.get(l.contextTag) ?? 0) + 1);
  }
  if (tagged < minTagged) return null;
  let top: { key: ContextTag; share: number } | null = null;
  for (const [key, n] of counts) {
    if (!top || n / tagged > top.share) top = { key, share: n / tagged };
  }
  return top;
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

  const byWeekpart = new Map<string, Bucket>();
  const moodOnDone: number[] = [];

  for (const log of logs) {
    if (log.skipped) continue;
    const done = log.completed === 1;
    const dow = dayKeyToDate(log.date).getDay();
    tally(byWeekpart, dow === 0 || dow === 6 ? 'weekends' : 'weekdays', done);
    if (done && log.moodTag) moodOnDone.push(log.moodTag);
  }

  const ctx = topContextShare(logs);
  if (ctx && ctx.share >= 0.6) {
    return `${Math.round(ctx.share * 100)}% of your ${habitName} completions happen ${
      CONTEXT_LABELS[ctx.key]
    } — that's the setting it sticks in.`;
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

  const byWeekpart = new Map<string, Bucket>();
  const byTime = new Map<string, Bucket>();
  const moodOnDone: number[] = [];
  for (const log of logs) {
    if (log.skipped) continue;
    const done = log.completed === 1;
    const dow = dayKeyToDate(log.date).getDay();
    tally(byWeekpart, dow === 0 || dow === 6 ? 'weekends' : 'weekdays', done);
    tally(byTime, timeBucket(log.loggedAt), done);
    if (done && log.moodTag) moodOnDone.push(log.moodTag);
  }

  const part = bestOf(byWeekpart, 3);
  const otherPart = part && byWeekpart.get(part.key === 'weekdays' ? 'weekends' : 'weekdays');
  const ctx = topContextShare(logs);
  const ctxClause = ctx
    ? `most of your wins happen ${CONTEXT_LABELS[ctx.key]} (${Math.round(ctx.share * 100)}%)`
    : null;

  if (part && otherPart && otherPart.total >= 3 && part.rate - rate(otherPart) >= 0.05) {
    const lead = `You complete ${Math.round(part.rate * 100)}% of habits on ${part.key} versus ${Math.round(
      rate(otherPart) * 100,
    )}% on ${part.key === 'weekdays' ? 'weekends' : 'weekdays'}`;
    return ctxClause ? `${lead}, and ${ctxClause}.` : `${lead}.`;
  }
  if (ctxClause) {
    return `Your consistency holds across the week, and ${ctxClause}.`;
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
