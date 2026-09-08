'use client';

import { memo, useState } from 'react';
import { motion, useReducedMotion, useMotionValue, animate } from 'framer-motion';
import { Flame, Trash2, Clock, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { spring, reducedFade, chartHex, onChartHex, semantic, palette } from '@/theme/theme';
import { formatHHmm } from '@/lib/dates';
import { minutesUntilWindowClose, isWindowClosingSoon, formatCountdown } from '@/lib/timeConstraint';
import { CompletionToggle } from './CompletionToggle';
import { ContributionGrid } from '@/components/chart/ContributionGrid';
import type { HabitView } from '@/context/AppContext';

/**
 * Habit Card.
 *
 * Two states, two silhouettes — the filled-versus-outlined rhythm the whole
 * app uses:
 *
 *   not done  → a neutral surface with the habit's hue on its numeral only
 *   done      → an OUTLINED pill in the habit's hue, black inside, with the
 *               hue on the border, the category label, the numeral and the
 *               filled check circle
 *
 * A list of five completed habits therefore reads as five coloured rings on
 * black, not five solid slabs. Solid fills are reserved for the one hero
 * block per screen (the Home "Today" block when the day is complete).
 *
 * Presentational only: it receives a habit and callbacks and never queries
 * the database itself (CLAUDE.md §6).
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
  const countdownMins = !done ? minutesUntilWindowClose(habit.timeConstraint) : null;
  const closingSoon = !done && isWindowClosingSoon(habit.timeConstraint);

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
          // Outlined when done, neutral surface when not. Never a solid fill.
          backgroundColor: done ? palette.ink0 : semantic.bgSecondary,
          borderColor: done ? accent : 'transparent',
        }}
        onDragEnd={(_, info) => {
          const shouldReveal = info.offset.x < -40;
          setRevealed(shouldReveal);
          animate(x, shouldReveal ? -72 : 0, reduce ? { duration: 0.12 } : spring.default);
        }}
        whileTap={reduce ? { opacity: 0.92 } : { scale: 0.985 }}
        transition={reduce ? reducedFade : spring.default}
        className={cn(
          'group relative rounded-[var(--radius-card)] border-2 p-4 transition-colors duration-200',
          !done && 'hover:bg-bg-tertiary',
        )}
      >
        <div className="flex items-center gap-4">
          <CompletionToggle
            completed={done}
            onToggle={(next) => onToggle(habit.id, next)}
            habitName={habit.name}
            accent={accent}
            onAccent={onAccent}
            locked={locked}
            lockedReason={
              habit.timeConstraint
                ? `Late — window closed at ${formatHHmm(habit.timeConstraint)}. Tap to log it anyway.`
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
              <p className="font-data mb-2 text-label-tertiary">{habit.categoryTag}</p>
            )}
            <p className="font-display truncate text-[19px] leading-tight text-label-primary">
              {habit.name}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {habit.streak > 0 && (
                <span className="inline-flex items-center gap-1 text-footnote text-label-secondary">
                  <Flame size={13} aria-hidden />
                  <span className="tnum">{habit.streak}</span> day
                  {habit.streak === 1 ? '' : 's'}
                </span>
              )}
              {habit.timeConstraint && !done && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-footnote',
                    closingSoon && 'font-semibold',
                  )}
                  style={{ color: locked ? 'var(--color-app-orange)' : semantic.warning }}
                >
                  <Clock size={12} aria-hidden />
                  {locked
                    ? `Late — was due ${formatHHmm(habit.timeConstraint)}`
                    : countdownMins !== null
                      ? `${formatCountdown(countdownMins)}${closingSoon ? ' · closing soon' : ''}`
                      : `by ${formatHHmm(habit.timeConstraint)}`}
                </span>
              )}
              {habit.isAtRisk && (
                <span
                  className="inline-flex items-center gap-1 text-footnote"
                  style={{ color: palette.vermillion }}
                >
                  <TrendingDown size={12} aria-hidden />
                  At risk
                </span>
              )}
            </div>
          </button>

          {/* Stat pattern: numeral over a tiny uppercase label. The numeral is
              always in the habit's hue — the one place the hue shows on an
              undone card. */}
          <div className="flex shrink-0 flex-col items-end">
            <span className="font-display-hero text-[36px] leading-none" style={{ color: accent }}>
              {statValue ?? Math.round(habit.momentumScore)}
            </span>
            <span className="font-data mt-2 text-label-tertiary">{statLabel ?? 'Momentum'}</span>
          </div>

          {onDelete && (
            <button
              type="button"
              aria-label={`Delete ${habit.name}`}
              onClick={() => onDelete(habit.id)}
              className={cn(
                'ml-1 hidden size-11 shrink-0 items-center justify-center rounded-[var(--radius-pill)] lg:inline-flex',
                'text-label-secondary opacity-0 transition-opacity duration-150',
                'group-hover:opacity-60 focus-visible:opacity-100 hover:!opacity-100',
              )}
            >
              <Trash2 size={18} aria-hidden />
            </button>
          )}
        </div>

        {showGrid && (
          <div className="mt-4 border-t border-white/[0.07] pt-4">
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
