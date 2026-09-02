'use client';

import { Lightbulb, TrendingDown, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/Button';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { spring, reducedFade } from '@/theme/theme';
import type { DifficultyLevel } from '@/db/schema';

const DIFFICULTY_NAMES: Record<DifficultyLevel, string> = {
  1: 'Easy',
  2: 'Medium',
  3: 'Hard',
};

/**
 * Insight card — the "explain the pattern, don't just record it" surface
 * (CLAUDE.md §2). Shared by Habit Detail and Statistics; the copy differs, the
 * component doesn't.
 *
 * `hint` renders the pre-insight state for a habit without enough history yet
 * (ui-spec.md §6 — minimum 3 logged days before attempting a correlation).
 */
export function InsightCard({ text, hint = false }: { text: string; hint?: boolean }) {
  return (
    <div className="flex gap-3 rounded-[var(--radius-card)] bg-bg-secondary p-5">
      <Lightbulb
        size={20}
        className={hint ? 'shrink-0 text-label-secondary' : 'shrink-0 text-warning'}
        aria-hidden
      />
      <div>
        <p className="text-caption1 uppercase tracking-wide text-label-secondary">
          {hint ? 'Not enough data yet' : 'Insight'}
        </p>
        <p className="mt-1 text-body text-label-primary">{text}</p>
      </div>
    </div>
  );
}

/**
 * Adaptive difficulty suggestion banner (data-model.md §4.5, ui-spec.md §6).
 * Conditional — only rendered when missStreak >= 3. It is a PROPOSAL: accepting
 * is the user's action, the app never changes difficulty on its own.
 */
export function AdaptiveDifficultyBanner({
  habitName,
  currentLevel,
  suggestedLevel,
  onAccept,
  onDismiss,
}: {
  habitName: string;
  currentLevel: DifficultyLevel;
  suggestedLevel: DifficultyLevel;
  onAccept: () => void;
  onDismiss: () => void;
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
        <div className="rounded-[var(--radius-card)] border border-warning/30 bg-warning/10 p-5">
          <div className="flex items-start gap-3">
            {/* Warning, not destructive — a dip is not an error (design-system.md §1.2). */}
            <TrendingDown size={20} className="mt-1 shrink-0 text-warning" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-headline font-semibold">Scale this one down?</p>
              <p className="mt-1 text-subheadline text-label-secondary">
                {habitName} has been missed a few days running. Dropping it from{' '}
                {DIFFICULTY_NAMES[currentLevel]} to {DIFFICULTY_NAMES[suggestedLevel]} makes it
                easier to restart — your momentum and history stay exactly as they are.
              </p>
              <div className="mt-4">
                <Button onClick={onAccept} className="text-subheadline">
                  Scale down to {DIFFICULTY_NAMES[suggestedLevel]}
                </Button>
              </div>
            </div>
            <IconButton label="Dismiss this suggestion" onClick={onDismiss}>
              <X size={18} aria-hidden />
            </IconButton>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
