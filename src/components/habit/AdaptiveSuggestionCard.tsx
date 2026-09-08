'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { reducedFade, palette } from '@/theme/theme';
import type { AdaptiveDifficultySuggestion } from '@/lib/momentum';
import type { DifficultyLevel } from '@/db/schema';

const DIFFICULTY_NAMES: Record<DifficultyLevel, string> = {
  1: 'Easy',
  2: 'Medium',
  3: 'Hard',
};

/**
 * The adaptive-difficulty proposal — shown under any habit MomentumService's
 * checkAdaptiveDifficulty() flags (3+ consecutive misses), on both the
 * Habits list and Habit Detail. It only ever proposes: "Scale down" hands
 * off to the normal edit form with the suggested level pre-filled rather
 * than writing anything itself, and "Not now" is the only action that
 * changes state on its own — a 7-day dismissal, not a habit edit.
 */
export function AdaptiveSuggestionCard({
  habitName,
  currentLevel,
  suggestion,
  onScaleDown,
  onNotNow,
}: {
  habitName: string;
  currentLevel: DifficultyLevel;
  suggestion: AdaptiveDifficultySuggestion;
  onScaleDown: () => void;
  onNotNow: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 'auto', opacity: 1 }}
        exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
        transition={reduce ? reducedFade : { duration: 0.2 }}
        className="overflow-hidden"
      >
        <div
          className="rounded-[var(--radius-card)] border-2 bg-bg-secondary p-4"
          style={{ borderColor: palette.amber }}
        >
          <p className="font-data" style={{ color: palette.amber }}>
            Missed {suggestion.missStreakDays} Days In A Row
          </p>
          <p className="mt-2 text-body leading-relaxed text-label-primary">
            {habitName} keeps slipping. Drop it from {DIFFICULTY_NAMES[currentLevel]} to{' '}
            {DIFFICULTY_NAMES[suggestion.suggestedLevel]} for a week?
          </p>
          <p className="mt-1 text-footnote text-label-tertiary">
            Nothing changes unless you say so.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              className="flex-1"
              style={{ backgroundColor: palette.amber, color: palette.ink0 }}
              onClick={onScaleDown}
            >
              Scale Down
            </Button>
            <Button variant="secondary" className="flex-1" onClick={onNotNow}>
              Not Now
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
