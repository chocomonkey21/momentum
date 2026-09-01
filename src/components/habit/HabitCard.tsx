'use client';

import { memo, useState } from 'react';
import { motion, useReducedMotion, useMotionValue, animate } from 'framer-motion';
import { Flame, Trash2, Clock, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { spring, reducedFade, semantic, chartHex } from '@/theme/theme';
import { momentumBand } from '@/lib/momentum';
import { formatHHmm } from '@/lib/dates';
import { CompletionToggle } from './CompletionToggle';
import type { HabitView } from '@/context/AppContext';

/**
 * Habit Card (design-system.md §7): card.bg, 16px radius, category eyebrow +
 * title + streak badge. Presentational only — it receives a habit and callbacks
 * and never queries the database itself (CLAUDE.md §6).
 *
 * Delete has three input paths per interaction-spec.md §13:
 *   - mobile: swipe-left to reveal, 1:1 pointer tracking during the drag
 *   - desktop: a Trash2 icon that fades in on row hover
 *   - keyboard/screen reader: that same button is always in the DOM and
 *     focusable, so hover/swipe is never the only route to it
 */
export const HabitCard = memo(function HabitCard({
  habit,
  onToggle,
  onOpen,
  onDelete,
  /** Stat shown on the right, driven by the Habits List segmented control. */
  statLabel,
  statValue,
}: {
  habit: HabitView;
  onToggle: (habitId: number, next: boolean) => void;
  onOpen: (habitId: number) => void;
  onDelete?: (habitId: number) => void;
  statLabel?: string;
  statValue?: string;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const [revealed, setRevealed] = useState(false);

  const locked = habit.locked;
  const band = momentumBand(habit.momentumScore);
  const accent = chartHex(habit.chartColor);

  return (
    <div className="relative">
      {/* Destructive action revealed behind the row on swipe (mobile). */}
      {onDelete && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-5">
          <button
            type="button"
            aria-label={`Delete ${habit.name}`}
            onClick={() => onDelete(habit.id)}
            className={cn(
              'inline-flex size-11 items-center justify-center rounded-full',
              'bg-destructive/15 text-destructive transition-opacity',
              revealed ? 'opacity-100' : 'opacity-0',
            )}
          >
            <Trash2 size={18} aria-hidden />
          </button>
        </div>
      )}

      <motion.div
        drag={reduce ? 'x' : 'x'}
        dragConstraints={{ left: -72, right: 0 }}
        dragElastic={0.05}
        style={{ x }}
        onDragEnd={(_, info) => {
          const shouldReveal = info.offset.x < -40;
          setRevealed(shouldReveal);
          animate(x, shouldReveal ? -72 : 0, reduce ? { duration: 0.12 } : spring.default);
        }}
        whileHover={reduce ? undefined : { y: -2 }}
        whileTap={reduce ? { opacity: 0.9 } : { scale: 0.98 }}
        transition={reduce ? reducedFade : spring.default}
        className={cn(
          'group relative flex items-center gap-4 rounded-[var(--radius-card)]',
          'bg-bg-secondary p-4 transition-[background-color,box-shadow] duration-150',
          'hover:bg-bg-tertiary hover:shadow-lg hover:shadow-black/40',
        )}
      >
        {/* Stable per-habit hue, so the card ties visually to its chart band. */}
        <span
          aria-hidden
          className="absolute inset-y-4 left-0 w-1 rounded-r-full"
          style={{ backgroundColor: accent }}
        />

        <CompletionToggle
          completed={habit.todayLog?.completed === 1}
          onToggle={(next) => onToggle(habit.id, next)}
          habitName={habit.name}
          locked={locked}
          lockedReason={
            habit.timeConstraint
              ? `Logging closed — deadline was ${formatHHmm(habit.timeConstraint)}`
              : undefined
          }
        />

        {/* The card body is the navigation target; the toggle above is not. */}
        <button
          type="button"
          onClick={() => onOpen(habit.id)}
          className="min-w-0 flex-1 text-left"
          // One focusable element combining name + status + streak (ui-spec.md §4).
          aria-label={`${habit.name}, ${habit.categoryTag ?? 'uncategorised'}, momentum ${Math.round(
            habit.momentumScore,
          )} of 100, ${habit.streak} day streak. Open details.`}
        >
          {habit.categoryTag && (
            <p className="mb-0.5 text-caption1 uppercase tracking-wide text-label-secondary">
              {habit.categoryTag}
            </p>
          )}
          <p className="truncate text-headline font-semibold text-label-primary">{habit.name}</p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {habit.streak > 0 && (
              <span className="inline-flex items-center gap-1 text-footnote text-label-secondary">
                {/* The flame keeps its orange — colour is meaningful here (§6). */}
                <Flame size={13} className="text-warning" aria-hidden />
                {habit.streak} day{habit.streak === 1 ? '' : 's'}
              </span>
            )}
            {habit.timeConstraint && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-footnote',
                  locked ? 'text-label-secondary' : 'text-warning',
                )}
              >
                {locked ? <Lock size={12} aria-hidden /> : <Clock size={12} aria-hidden />}
                {locked ? 'Closed' : `by ${formatHHmm(habit.timeConstraint)}`}
              </span>
            )}
          </div>
        </button>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className="text-headline font-semibold tabular-nums"
            style={{
              // Zero is NEVER destructive red — a dipping score is warning at
              // worst (design-system.md §1.2, CLAUDE.md §4).
              color:
                band === 'strong'
                  ? semantic.positive
                  : band === 'dipping'
                    ? semantic.warning
                    : semantic.labelPrimary,
            }}
          >
            {statValue ?? Math.round(habit.momentumScore)}
          </span>
          <span className="text-caption1 uppercase tracking-wide text-label-secondary">
            {statLabel ?? 'Momentum'}
          </span>
        </div>

        {onDelete && (
          <button
            type="button"
            aria-label={`Delete ${habit.name}`}
            onClick={() => onDelete(habit.id)}
            className={cn(
              'ml-1 hidden size-11 shrink-0 items-center justify-center rounded-full lg:inline-flex',
              'text-label-secondary opacity-0 transition-opacity duration-150',
              // Appears on hover, but also on keyboard focus so it is never
              // hover-only (definition-of-done.md accessibility).
              'group-hover:opacity-100 focus-visible:opacity-100 hover:text-destructive',
            )}
          >
            <Trash2 size={18} aria-hidden />
          </button>
        )}
      </motion.div>
    </div>
  );
});
