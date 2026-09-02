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
const VERDICT_STYLES: Record<Verdict, { bg: string; fg: string }> = {
  'Strong week': { bg: semantic.positive, fg: palette.ink0 },
  Steady: { bg: semantic.tint, fg: palette.white },
  Slipping: { bg: semantic.warning, fg: palette.ink0 },
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
                    'w-full rounded-[var(--radius-card)] bg-bg-secondary p-5 text-left',
                    'transition-colors duration-150 hover:bg-bg-tertiary',
                  )}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className="font-display min-w-0 flex-1 truncate text-[19px]">
                      {habit.name}
                    </span>
                    <span
                      className="font-data shrink-0 rounded-[var(--radius-pill)] px-3 py-1.5"
                      style={{
                        color: VERDICT_STYLES[verdict].fg,
                        backgroundColor: VERDICT_STYLES[verdict].bg,
                      }}
                    >
                      {verdict}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-label-tertiary" aria-hidden />
                  </div>

                  {/* Stat pattern — the week's count is the number that matters. */}
                  <div className="mb-4 flex items-baseline gap-2">
                    <span className="font-display-hero text-[40px] leading-none">{completions}</span>
                    <span className="font-data text-label-tertiary">of {outOf} days</span>
                  </div>
                  <p className="text-body leading-relaxed text-label-secondary">{sentence}</p>
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </PageFade>
    </Screen>
  );
}
