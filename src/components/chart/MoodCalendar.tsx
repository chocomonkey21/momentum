'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, getDay, isAfter } from 'date-fns';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/Button';
import { MOOD_COLORS, MOOD_LABELS, UNLOGGED_DAY_COLOR, semantic, spring, reducedFade } from '@/theme/theme';
import { toDayKey, dayKeyRange } from '@/lib/dates';
import type { HabitLog, MoodTag } from '@/db/schema';

/**
 * Mood Calendar (design-system.md §8) — the model for Habit Detail → History.
 * A month grid where each day's dot colour is that day's MoodTag, not merely
 * done/not-done. This is what makes Context Tagging visible rather than just
 * stored, and it's the direct translation of the "dotyo." reference.
 *
 * Unlogged days render as the empty ink shade, per §8.
 */
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function MoodCalendar({
  logs,
  onSelectDay,
  selectedDay,
}: {
  logs: HabitLog[];
  onSelectDay: (dayKey: string) => void;
  selectedDay: string | null;
}) {
  const reduce = useReducedMotion();

  /**
   * Open on the month containing the most recent logged day rather than always
   * on the current month. For an active user those are the same month, so this
   * is a no-op; it only differs in the edge case where today is early in a new
   * month and all the history sits in the previous one — where defaulting to
   * "now" would show an almost-empty grid and hide the habit's whole history
   * behind a back arrow.
   */
  const initialOffset = useMemo(() => {
    const latest = logs.reduce<string | null>(
      (max, l) => (max === null || l.date > max ? l.date : max),
      null,
    );
    if (!latest) return 0;
    const now = new Date();
    const latestDate = new Date(latest + 'T00:00:00');
    const months =
      (latestDate.getFullYear() - now.getFullYear()) * 12 +
      (latestDate.getMonth() - now.getMonth());
    return Math.min(0, months);
  }, [logs]);

  const [monthOffset, setMonthOffset] = useState(initialOffset);
  const [direction, setDirection] = useState(0);

  const month = useMemo(() => addMonths(new Date(), monthOffset), [monthOffset]);
  const byDate = useMemo(() => new Map(logs.map((l) => [l.date, l])), [logs]);

  const days = useMemo(
    () => dayKeyRange(toDayKey(startOfMonth(month)), toDayKey(endOfMonth(month))),
    [month],
  );
  const leadingBlanks = getDay(startOfMonth(month));
  const today = toDayKey(new Date());

  // Don't let the user page into the future — there's nothing to show there.
  const canGoForward = monthOffset < 0;

  function move(delta: number) {
    setDirection(delta);
    setMonthOffset((m) => m + delta);
  }

  return (
    <section aria-label="Mood history calendar">
      <div className="mb-3 flex items-center justify-between">
        <IconButton label="Previous month" onClick={() => move(-1)}>
          <ChevronLeft size={20} aria-hidden />
        </IconButton>
        <h3 className="text-headline font-semibold">{format(month, 'MMMM yyyy')}</h3>
        <IconButton
          label="Next month"
          onClick={() => move(1)}
          disabled={!canGoForward}
          className={cn(!canGoForward && 'opacity-30')}
        >
          <ChevronRight size={20} aria-hidden />
        </IconButton>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d, i) => (
          <span
            key={i}
            aria-hidden
            className="text-center text-caption1 uppercase text-label-secondary"
          >
            {d}
          </span>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={monthOffset}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: direction * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: direction * -24 }}
          transition={reduce ? reducedFade : spring.default}
          className="grid grid-cols-7 gap-1"
        >
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <span key={`blank-${i}`} aria-hidden />
          ))}

          {days.map((dayKey) => {
            const log = byDate.get(dayKey);
            const isFuture = isAfter(new Date(dayKey + 'T00:00:00'), new Date());
            const dayNum = Number(dayKey.slice(-2));
            const selected = selectedDay === dayKey;

            const color = log
              ? log.moodTag
                ? MOOD_COLORS[log.moodTag as MoodTag]
                : log.completed === 1
                  ? semantic.positive
                  : UNLOGGED_DAY_COLOR
              : UNLOGGED_DAY_COLOR;

            const statusText = !log
              ? 'not logged'
              : log.completed === 1
                ? 'completed'
                : 'missed';
            const moodText = log?.moodTag ? `, mood: ${MOOD_LABELS[log.moodTag as MoodTag]}` : '';

            return (
              <button
                key={dayKey}
                type="button"
                disabled={isFuture}
                onClick={() => onSelectDay(dayKey)}
                // Individually focusable with a full spoken label (ui-spec.md §6).
                aria-label={`${format(new Date(dayKey + 'T00:00:00'), 'MMMM do')}, ${statusText}${moodText}`}
                className={cn(
                  'flex aspect-square min-h-[36px] flex-col items-center justify-center gap-1',
                  'rounded-[8px] transition-colors',
                  isFuture ? 'opacity-25' : 'hover:bg-bg-tertiary',
                  selected && 'bg-bg-tertiary ring-2 ring-tint',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'block rounded-full transition-transform',
                    log?.completed === 1 ? 'size-3.5' : 'size-2.5',
                    dayKey === today && 'ring-2 ring-white ring-offset-2 ring-offset-black',
                  )}
                  style={{
                    backgroundColor: color,
                    // Missed days read as a hollow marker, not a filled one.
                    opacity: log && log.completed === 0 ? 0.55 : 1,
                  }}
                />
                <span className="text-[10px] leading-none text-label-secondary">{dayNum}</span>
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>

      <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {([1, 2, 3, 4, 5] as MoodTag[]).map((m) => (
          <li key={m} className="flex items-center gap-1">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ backgroundColor: MOOD_COLORS[m] }}
            />
            <span className="text-caption1 text-label-secondary">{MOOD_LABELS[m]}</span>
          </li>
        ))}
        <li className="flex items-center gap-1">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ backgroundColor: UNLOGGED_DAY_COLOR }}
          />
          <span className="text-caption1 text-label-secondary">Not logged</span>
        </li>
      </ul>
    </section>
  );
}

/**
 * Streak Dot Row (design-system.md §8) — last 21 days, filled = completed,
 * outline = missed, in color.tint.
 */
export function StreakDotRow({ logs, days = 21 }: { logs: HabitLog[]; days?: number }) {
  const byDate = useMemo(() => new Map(logs.map((l) => [l.date, l])), [logs]);
  const keys = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    return dayKeyRange(toDayKey(start), toDayKey(end));
  }, [days]);

  const completed = keys.filter((k) => byDate.get(k)?.completed === 1).length;

  return (
    <div>
      <div
        className="flex flex-wrap items-center gap-1"
        role="img"
        aria-label={`Last ${days} days: ${completed} completed`}
      >
        {keys.map((k) => {
          const done = byDate.get(k)?.completed === 1;
          return (
            <span
              key={k}
              aria-hidden
              className={cn('size-2.5 rounded-full border-2')}
              style={{
                borderColor: semantic.tint,
                backgroundColor: done ? semantic.tint : 'transparent',
                opacity: done ? 1 : 0.45,
              }}
            />
          );
        })}
      </div>
      <p className="mt-2 text-footnote text-label-secondary">
        {completed} of the last {days} days
      </p>
    </div>
  );
}

/**
 * Dense metric footer beneath the calendar, in the register of the "dotyo"
 * reference: a row of big numerals over tiny mono captions, with the two
 * qualitative figures picked out in the mood colour they describe.
 */
export function MoodStatsFooter({ logs }: { logs: HabitLog[] }) {
  const stats = useMemo(() => {
    // A deliberate skip doesn't count toward consistency — it's neither a
    // completion nor a miss, so it's excluded from "Logged"/"Done %" here.
    const counted = logs.filter((l) => !l.skipped);
    const logged = counted.length;
    const done = counted.filter((l) => l.completed === 1).length;
    const donePct = logged === 0 ? 0 : Math.round((done / logged) * 100);

    const moodCounts = new Map<MoodTag, number>();
    for (const l of logs) {
      if (l.moodTag) moodCounts.set(l.moodTag as MoodTag, (moodCounts.get(l.moodTag as MoodTag) ?? 0) + 1);
    }
    let topMood: MoodTag | null = null;
    let topCount = 0;
    for (const [m, c] of moodCounts) {
      if (c > topCount) {
        topMood = m;
        topCount = c;
      }
    }

    // Longest run of consecutive missed days — the "max gap" figure. A
    // skipped day is neutral: it doesn't extend a gap, but doesn't reset it
    // either (mirrors the momentum replay's pause/skip handling).
    const ordered = [...logs].sort((a, b) => a.date.localeCompare(b.date));
    let gap = 0;
    let maxGap = 0;
    for (const l of ordered) {
      if (l.skipped) continue;
      if (l.completed === 1) gap = 0;
      else {
        gap += 1;
        if (gap > maxGap) maxGap = gap;
      }
    }

    const tags = new Set(logs.map((l) => l.contextTag).filter(Boolean)).size;
    const notes = logs.filter((l) => l.notes).length;

    return { logged, donePct, maxGap, topMood, tags, notes };
  }, [logs]);

  return (
    <div className="mt-6 border-t border-white/5 pt-5">
      <dl className="grid grid-cols-3 gap-y-5 sm:grid-cols-6">
        <Metric label="Logged" value={String(stats.logged)} />
        <Metric label="Done %" value={`${stats.donePct}%`} />
        <Metric label="Max gap" value={String(stats.maxGap)} />
        <Metric
          label="Top mood"
          value={stats.topMood ? MOOD_LABELS[stats.topMood] : '—'}
          color={stats.topMood ? MOOD_COLORS[stats.topMood] : undefined}
        />
        <Metric label="Tags" value={String(stats.tags)} />
        <Metric label="Notes" value={String(stats.notes)} />
      </dl>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <dd
        className="font-display text-[22px] leading-none tnum"
        style={color ? { color } : undefined}
      >
        {value}
      </dd>
      <dt className="font-data mt-1 text-[10px] text-label-tertiary">{label}</dt>
    </div>
  );
}
