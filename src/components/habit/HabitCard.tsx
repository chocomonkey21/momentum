'use client';

import { memo, useState } from 'react';
import { motion, useReducedMotion, useMotionValue, animate } from 'framer-motion';
import { Flame, Trash2, Clock, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { spring, reducedFade, chartHex, chartAlpha, onChartHex, semantic } from '@/theme/theme';
import { momentumBand } from '@/lib/momentum';
import { formatHHmm } from '@/lib/dates';
import { CompletionToggle } from './CompletionToggle';
import { ContributionGrid } from '@/components/chart/ContributionGrid';
import type { HabitView } from '@/context/AppContext';

/**
 * Habit Card — colour-blocked in the habit's own hue.
 *
 * The card carries a low-alpha wash and a matching hairline of its habit
 * colour, so a list of habits reads as a set of distinct blocks rather than
 * identical grey rows. The momentum number is the loudest thing on the card
 * (CLAUDE.md §3 — momentum is the hero).
 *
 * Presentational only: it receives a habit and callbacks and never queries the
 * database itself (CLAUDE.md §6).
 *
 * Delete has three input paths per interaction-spec.md §13 — swipe on mobile,
 * hover icon on desktop, and a persistently focusable button for keyboard and
 * screen-reader users.
 */
export const HabitCard = memo(function HabitCard({
  habit,
  onToggle,
  onOpen,
  onDelete,
  statLabel,
  statValue,
  /** Renders the GitHub-style activity grid inside the card (year view). */
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
  const band = momentumBand(habit.momentumScore);
  const accent = chartHex(habit.chartColor);
  const done = habit.todayLog?.completed === 1;

  return (
    <div className="relative">
      {onDelete && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-5">
          <button
            type="button"
            aria-label={`Delete ${habit.name}`}
            onClick={() => onDelete(habit.id)}
            className={cn(
              'inline-flex size-11 items-center justify-center rounded-[14px]',
              'bg-destructive/15 text-destructive transition-opacity',
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
          // Tinted wash: stronger once the habit is done for today, so
          // completion is legible from across the room.
          background: `linear-gradient(160deg, ${chartAlpha(
            habit.chartColor,
            done ? 0.22 : 0.12,
          )} 0%, rgba(255,255,255,0.02) 60%)`,
          borderColor: chartAlpha(habit.chartColor, done ? 0.45 : 0.22),
        }}
        onDragEnd={(_, info) => {
          const shouldReveal = info.offset.x < -40;
          setRevealed(shouldReveal);
          animate(x, shouldReveal ? -72 : 0, reduce ? { duration: 0.12 } : spring.default);
        }}
        whileHover={reduce ? undefined : { y: -3 }}
        whileTap={reduce ? { opacity: 0.9 } : { scale: 0.985 }}
        transition={reduce ? reducedFade : spring.default}
        className={cn(
          'group relative rounded-[var(--radius-card)] border bg-bg-secondary p-4',
          'transition-shadow duration-150 hover:shadow-2xl hover:shadow-black/60',
        )}
      >
        <div className="flex items-center gap-4">
          <CompletionToggle
            completed={done}
            onToggle={(next) => onToggle(habit.id, next)}
            habitName={habit.name}
            accent={accent}
            onAccent={onChartHex(habit.chartColor)}
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
                className="font-data mb-1 text-[10px]"
                style={{ color: chartAlpha(habit.chartColor, 0.9) }}
              >
                {habit.categoryTag}
              </p>
            )}
            <p className="font-display truncate text-[19px] leading-tight text-label-primary">
              {habit.name}
            </p>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {habit.streak > 0 && (
                <span className="inline-flex items-center gap-1 text-footnote text-label-secondary">
                  <Flame size={13} className="text-warning" aria-hidden />
                  <span className="tnum">{habit.streak}</span> day
                  {habit.streak === 1 ? '' : 's'}
                </span>
              )}
              {habit.timeConstraint && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-footnote',
                    locked ? 'text-label-tertiary' : 'text-warning',
                  )}
                >
                  {locked ? <Lock size={12} aria-hidden /> : <Clock size={12} aria-hidden />}
                  {locked ? 'Closed' : `by ${formatHHmm(habit.timeConstraint)}`}
                </span>
              )}
            </div>
          </button>

          <div className="flex shrink-0 flex-col items-end">
            <span
              className="font-display-hero text-[34px] leading-none"
              style={{
                // Zero is NEVER destructive red — a dipping score is warning at
                // worst (CLAUDE.md §4).
                color:
                  statValue !== undefined
                    ? semantic.labelPrimary
                    : band === 'dipping'
                      ? semantic.warning
                      : accent,
              }}
            >
              {statValue ?? Math.round(habit.momentumScore)}
            </span>
            <span className="font-data mt-1 text-[9px] text-label-tertiary">
              {statLabel ?? 'Momentum'}
            </span>
          </div>

          {onDelete && (
            <button
              type="button"
              aria-label={`Delete ${habit.name}`}
              onClick={() => onDelete(habit.id)}
              className={cn(
                'ml-1 hidden size-11 shrink-0 items-center justify-center rounded-[14px] lg:inline-flex',
                'text-label-tertiary opacity-0 transition-opacity duration-150',
                'group-hover:opacity-100 focus-visible:opacity-100 hover:text-destructive',
              )}
            >
              <Trash2 size={18} aria-hidden />
            </button>
          )}
        </div>

        {showGrid && (
          <div className="mt-4 border-t border-white/5 pt-4">
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
