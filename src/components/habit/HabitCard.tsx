'use client';

import { memo, useState } from 'react';
import { motion, useReducedMotion, useMotionValue, animate } from 'framer-motion';
import { Flame, Trash2, Clock, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { spring, reducedFade, chartHex, onChartHex, semantic } from '@/theme/theme';
import { formatHHmm } from '@/lib/dates';
import { CompletionToggle } from './CompletionToggle';
import { ContributionGrid } from '@/components/chart/ContributionGrid';
import type { HabitView } from '@/context/AppContext';

/**
 * Habit Card — a solid block of the habit's own colour.
 *
 * The card is a flat, fully-saturated fill, not a neutral card with a coloured
 * accent. Colour carries category the way the charts and calendars already use
 * it, just applied with more confidence: a list of habits reads as a stack of
 * distinct blocks you can identify without reading a word.
 *
 * A habit that isn't done yet sits on the neutral surface and shows its colour
 * only as a small marker — so "done today" is the state that earns the full
 * block, and the screen visibly fills up with colour as the day is completed.
 *
 * Presentational only: it receives a habit and callbacks and never queries the
 * database itself (CLAUDE.md §6).
 */
export const HabitCard = memo(function HabitCard({
  habit,
  onToggle,
  onOpen,
  onDelete,
  statLabel,
  statValue,
  showGrid = false,
  gridWeeks = 30,
}: {
  habit: HabitView;
  onToggle: (habitId: number, next: boolean) => void;
  onOpen: (habitId: number) => void;
  onDelete?: (habitId: number) => void;
  statLabel?: string;
  statValue?: string;
  showGrid?: boolean;
  gridWeeks?: number;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const [revealed, setRevealed] = useState(false);

  const locked = habit.locked;
  const accent = chartHex(habit.chartColor);
  const onAccent = onChartHex(habit.chartColor);
  const done = habit.todayLog?.completed === 1;

  // On a filled card every foreground colour derives from the fill, so text
  // stays legible on amber and on vermillion alike.
  const primaryText = done ? onAccent : semantic.labelPrimary;
  const mutedText = done ? onAccent : semantic.labelSecondary;

  return (
    <div className="relative">
      {onDelete && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-5">
          <button
            type="button"
            aria-label={`Delete ${habit.name}`}
            onClick={() => onDelete(habit.id)}
            className={cn(
              'inline-flex size-11 items-center justify-center rounded-[var(--radius-pill)]',
              'bg-destructive text-white transition-opacity',
              revealed ? 'opacity-100' : 'opacity-0',
            )}
          >
            <Trash2 size={18} aria-hidden />
          </button>
        </div>
      )}

      <motion.div
        drag="x"
        dragConstraints={{ left: -72, right: 0 }}
        dragElastic={0.05}
        style={{
          x,
          // One flat fill. No gradient, no wash, no shadow.
          backgroundColor: done ? accent : semantic.bgSecondary,
        }}
        onDragEnd={(_, info) => {
          const shouldReveal = info.offset.x < -40;
          setRevealed(shouldReveal);
          animate(x, shouldReveal ? -72 : 0, reduce ? { duration: 0.12 } : spring.default);
        }}
        whileTap={reduce ? { opacity: 0.92 } : { scale: 0.985 }}
        transition={reduce ? reducedFade : spring.default}
        className={cn(
          'group relative rounded-[var(--radius-card)] p-4 transition-colors duration-200',
          !done && 'hover:bg-bg-tertiary',
        )}
      >
        <div className="flex items-center gap-4">
          <CompletionToggle
            completed={done}
            onToggle={(next) => onToggle(habit.id, next)}
            habitName={habit.name}
            accent={done ? onAccent : accent}
            onAccent={done ? accent : onChartHex(habit.chartColor)}
            locked={locked}
            lockedReason={
              habit.timeConstraint
                ? `Logging closed — deadline was ${formatHHmm(habit.timeConstraint)}`
                : undefined
            }
          />

          <button
            type="button"
            onClick={() => onOpen(habit.id)}
            className="min-w-0 flex-1 text-left"
            aria-label={`${habit.name}, ${habit.categoryTag ?? 'uncategorised'}, momentum ${Math.round(
              habit.momentumScore,
            )} of 100, ${habit.streak} day streak. Open details.`}
          >
            {habit.categoryTag && (
              <p
                className="font-data mb-1.5"
                style={{ color: mutedText, opacity: done ? 0.7 : 1 }}
              >
                {habit.categoryTag}
              </p>
            )}
            <p
              className="font-display truncate text-[19px] leading-tight"
              style={{ color: primaryText }}
            >
              {habit.name}
            </p>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {habit.streak > 0 && (
                <span
                  className="inline-flex items-center gap-1 text-footnote"
                  style={{ color: mutedText, opacity: done ? 0.75 : 1 }}
                >
                  <Flame size={13} aria-hidden />
                  <span className="tnum">{habit.streak}</span> day
                  {habit.streak === 1 ? '' : 's'}
                </span>
              )}
              {habit.timeConstraint && (
                <span
                  className="inline-flex items-center gap-1 text-footnote"
                  style={{
                    color: done ? mutedText : locked ? semantic.labelTertiary : semantic.warning,
                    opacity: done ? 0.75 : 1,
                  }}
                >
                  {locked ? <Lock size={12} aria-hidden /> : <Clock size={12} aria-hidden />}
                  {locked ? 'Closed' : `by ${formatHHmm(habit.timeConstraint)}`}
                </span>
              )}
            </div>
          </button>

          {/* Stat pattern: numeral over a tiny uppercase label. */}
          <div className="flex shrink-0 flex-col items-end">
            <span
              className="font-display-hero text-[34px] leading-none"
              style={{ color: done ? onAccent : accent }}
            >
              {statValue ?? Math.round(habit.momentumScore)}
            </span>
            <span
              className="font-data mt-1.5"
              style={{ color: mutedText, opacity: done ? 0.7 : 1 }}
            >
              {statLabel ?? 'Momentum'}
            </span>
          </div>

          {onDelete && (
            <button
              type="button"
              aria-label={`Delete ${habit.name}`}
              onClick={() => onDelete(habit.id)}
              className={cn(
                'ml-1 hidden size-11 shrink-0 items-center justify-center rounded-[var(--radius-pill)] lg:inline-flex',
                'opacity-0 transition-opacity duration-150',
                'group-hover:opacity-60 focus-visible:opacity-100 hover:!opacity-100',
              )}
              style={{ color: mutedText }}
            >
              <Trash2 size={18} aria-hidden />
            </button>
          )}
        </div>

        {showGrid && (
          <div
            className="mt-4 border-t pt-4"
            style={{ borderColor: done ? 'rgba(0,0,0,0.15)' : semantic.separator }}
          >
            <ContributionGrid
              logs={habit.logs}
              color={habit.chartColor}
              weeks={gridWeeks}
              cell={10}
              gap={3}
              showMonths={false}
              label={`${habit.name} activity`}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
});
