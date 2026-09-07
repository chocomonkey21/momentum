'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { motion, useReducedMotion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { Screen, ScreenHeader, PageFade } from '@/components/ui/Screen';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { verdictFor, recapSentence, bestDayOfWeek, type Verdict } from '@/lib/recap';
import { momentumSeries } from '@/lib/momentum';
import { dayKeyRange, toDayKey } from '@/lib/dates';
import { semantic, palette } from '@/theme/theme';
import { cn } from '@/lib/cn';

/**
 * Verdict badges are solid blocks of flat colour with dark text, not tinted
 * pills — the same treatment habit cards use, at chip scale.
 * Slipping is WARNING orange, never destructive red: a dip is not an error.
 */
/**
 * The verdict colours the card's OUTLINE and its numeral; the card itself
 * stays black. Green / blue / orange rings down the page, never three solid
 * slabs. Slipping is warning orange, never destructive red.
 */
const VERDICT_STYLES: Record<Verdict, { hue: string }> = {
  'Strong week': { hue: semantic.positive },
  Steady: { hue: palette.blue },
  Slipping: { hue: semantic.warning },
};

/**
 * Weekly Recap (ui-spec.md §12) — a generated narrative read on the past 7 days,
 * one card per active habit. Purely a read screen.
 */
export default function RecapPage() {
  const router = useRouter();
  const { status, errorMessage, retry, habits } = useApp();
  const reduce = useReducedMotion();

  const weekKeys = useMemo(
    () => dayKeyRange(toDayKey(subDays(new Date(), 6)), toDayKey(new Date())),
    [],
  );

  const recaps = useMemo(() => {
    return habits.map((habit) => {
      const inWeek = habit.logs.filter((l) => weekKeys.includes(l.date));
      const completions = inWeek.filter((l) => l.completed === 1).length;
      const outOf = weekKeys.length;

      // Momentum delta across the window, from the same replay the chart uses.
      const series = momentumSeries(habit.logs, weekKeys);
      const first = series.find((v) => v !== null) ?? habit.momentumScore;
      const last = [...series].reverse().find((v) => v !== null) ?? habit.momentumScore;
      const delta = Math.round((last ?? 0) - (first ?? 0));

      return {
        habit,
        completions,
        outOf,
        verdict: verdictFor(completions, outOf),
        sentence: recapSentence(
          habit.name,
          completions,
          outOf,
          bestDayOfWeek(inWeek),
          delta,
        ),
      };
    });
  }, [habits, weekKeys]);

  /**
   * ui-spec.md §12 empty state: a user without a full 7-day window yet gets
   * "come back after your first week" rather than a misleading partial recap.
   */
  const hasFullWeek = habits.some(
    (h) => new Date(h.createdAt) <= subDays(new Date(), 6),
  );
  const weeklySummary = useMemo(() => {
    const completed = recaps.reduce((sum, recap) => sum + recap.completions, 0);
    const possible = recaps.reduce((sum, recap) => sum + recap.outOf, 0);
    const momentum = habits.length
      ? Math.round(habits.reduce((sum, habit) => sum + habit.momentumScore, 0) / habits.length)
      : 0;
    const bestStreak = Math.max(0, ...habits.map((habit) => habit.streak));
    const headline = completed / Math.max(1, possible) >= 0.75
      ? "You're building momentum."
      : completed / Math.max(1, possible) >= 0.45
        ? "You're finding your rhythm."
        : "You're still in the game.";
    const sentence = completed > 0
      ? `You had your strongest week in the last month, mainly because ${recaps.find((r) => r.completions === Math.max(...recaps.map((item) => item.completions)))?.habit.name ?? 'your habits'} stayed consistent.`
      : 'A quieter week is still useful data. Start with one small win today.';
    return { completed, possible, momentum, bestStreak, headline, sentence };
  }, [habits, recaps]);

  return (
    <Screen>
      <PageFade>
        <ScreenHeader
          title="Weekly Recap"
          eyebrow={`Week of ${format(subDays(new Date(), 6), 'd MMMM')}`}
        />

        {status === 'error' ? (
          <ErrorState message={errorMessage ?? 'Something went wrong.'} onRetry={retry} />
        ) : status === 'loading' ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-36 w-full rounded-[var(--radius-card)]" />
            ))}
          </div>
        ) : habits.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            message="No habits to recap yet. Add one and your first weekly read lands in seven days."
            actionLabel="Add your first habit"
            onAction={() => router.push('/habits')}
          />
        ) : !hasFullWeek ? (
          <EmptyState
            icon={CalendarDays}
            message="Come back after your first week — a recap needs a full seven days to say anything useful."
          />
        ) : (
          <>
            <section className="mb-6 rounded-[var(--radius-card)] bg-bg-secondary p-6">
              <p className="font-data text-label-tertiary">WEEK {format(new Date(), 'w')}</p>
              <h2 className="font-display mt-2 text-[32px] leading-tight">{weeklySummary.headline}</h2>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div><p className="font-display-hero text-[42px]">{weeklySummary.momentum}%</p><p className="font-data text-label-tertiary">Overall Momentum</p></div>
                <div><p className="font-display-hero text-[42px]">{weeklySummary.completed} / {weeklySummary.possible}</p><p className="font-data text-label-tertiary">Habits completed</p></div>
                <div className="col-span-2"><p className="font-display-hero text-[32px]">{weeklySummary.bestStreak} days</p><p className="font-data text-label-tertiary">Best streak</p></div>
              </div>
              <p className="mt-5 text-body leading-relaxed text-label-secondary">{weeklySummary.sentence}</p>
            </section>
            <ul className="flex flex-col gap-3">
            {recaps.map(({ habit, completions, outOf, verdict, sentence }, i) => (
              <motion.li
                key={habit.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                // ~40ms stagger, same pattern as Home's first-load list.
                transition={{ delay: i * 0.04, duration: 0.25, ease: 'easeOut' }}
              >
                <button
                  type="button"
                  onClick={() => router.push(`/habits/${habit.id}`)}
                  aria-label={`${habit.name}, ${verdict}, ${completions} of ${outOf} days. Open details.`}
                  className={cn(
                    'w-full rounded-[var(--radius-card)] border-2 bg-bg-primary p-5 text-left',
                    'transition-transform duration-150 hover:-translate-y-1',
                  )}
                  style={{ borderColor: VERDICT_STYLES[verdict].hue }}
                >
                  <div className="mb-5 flex items-center gap-3">
                    <span className="font-data min-w-0 flex-1 truncate text-label-tertiary">
                      {habit.name}
                    </span>
                    <span
                      className="font-display shrink-0 rounded-[var(--radius-pill)] px-3 py-2 text-[14px] uppercase tracking-[0.04em] text-black"
                      style={{ backgroundColor: VERDICT_STYLES[verdict].hue }}
                    >
                      {verdict}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-label-tertiary" aria-hidden />
                  </div>

                  {/* Stat pattern — the week's count is the number that matters. */}
                  <div className="mb-4 flex items-baseline gap-2">
                    <span
                      className="font-display-hero text-[56px] leading-none"
                      style={{ color: VERDICT_STYLES[verdict].hue }}
                    >
                      {completions}
                    </span>
                    <span className="font-display-hero text-[22px] leading-none text-label-tertiary">
                      /{outOf}
                    </span>
                    <span className="font-data ml-1 text-label-tertiary">days</span>
                  </div>
                  <p className="max-w-[34ch] text-body leading-relaxed text-label-secondary">{sentence}</p>
                </button>
              </motion.li>
            ))}
            </ul>
          </>
        )}
      </PageFade>
    </Screen>
  );
}
