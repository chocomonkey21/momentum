'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { spring, reducedFade } from '@/theme/theme';

interface ChipProps {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  /** True when this chip sits in a group with a selection made elsewhere —
   *  unselected siblings dim slightly (interaction-spec.md §4). */
  dimmed?: boolean;
  disabled?: boolean;
  className?: string;
  /** Full-width row variant used by Onboarding step 3 (ui-spec.md §3). */
  block?: boolean;
}

/**
 * Chip — used for goal categories, frequency, difficulty, context tags and
 * duration presets. Selected fills with color.tint (interaction-spec.md §4).
 * Hover gives unselected chips a bg.tertiary lift (interaction-spec.md §15).
 */
export function Chip({
  selected,
  onSelect,
  children,
  dimmed = false,
  disabled = false,
  className,
  block = false,
}: ChipProps) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      whileTap={disabled ? undefined : reduce ? { opacity: 0.7 } : { scale: 0.96 }}
      transition={reduce ? reducedFade : spring.default}
      className={cn(
        'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-chip)]',
        'px-4 text-[length:var(--text-subheadline)] font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        selected
          ? 'bg-tint font-semibold text-white'
          : 'bg-bg-secondary text-label-secondary hover:bg-bg-tertiary hover:text-label-primary',
        !selected && dimmed && 'opacity-70',
        block && 'w-full justify-start px-5 text-left',
        className,
      )}
    >
      {children}
    </motion.button>
  );
}
