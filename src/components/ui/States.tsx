'use client';

import type { LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { StarburstSolid } from './Starburst';
import { cn } from '@/lib/cn';

/**
 * The required states from CLAUDE.md §14, as reusable primitives so every
 * list-bearing screen shows the same thing rather than reimplementing it.
 */

/**
 * Empty State — geometric mark, one line of body copy, one action.
 *
 * Copy is left-aligned: a centred paragraph is the fastest way to make a
 * product look like a template. The mark is the abstract burst rather than a
 * lucide glyph, because at this size an icon stops being an icon and starts
 * being an illustration.
 *
 * `icon` is still accepted so no call site had to change, but it is no longer
 * rendered — the burst is the single flourish across every empty state.
 */
export function EmptyState({
  icon: _icon,
  message,
  actionLabel,
  onAction,
  className,
}: {
  /** @deprecated Retained for call-site compatibility; the burst is used instead. */
  icon?: LucideIcon;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-6 rounded-[var(--radius-card)] bg-tint px-6 py-8 text-white',
        className,
      )}
    >
      {/* Pops in on the bouncy spring, then breathes slowly — the one
          animated flourish an empty screen gets. Static under reduced-motion. */}
      <motion.span
        initial={reduce ? false : { scale: 0, rotate: -45 }}
        animate={reduce ? { scale: 1 } : { scale: [1, 1.08, 1], rotate: 0 }}
        transition={
          reduce
            ? { duration: 0 }
            : {
                rotate: { type: 'spring', damping: 12, stiffness: 180 },
                scale: { delay: 0.5, duration: 4, repeat: Infinity, ease: 'easeInOut' },
              }
        }
        className="inline-flex"
      >
        <StarburstSolid size={44} className="text-white" />
      </motion.span>
      <p className="max-w-[30ch] font-display text-[24px] leading-[1.1]">{message}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="bg-white text-black hover:bg-white">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

/** Error State — human-readable message + a retry action. Never a raw error object. */
export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-4 rounded-[var(--radius-card)] bg-bg-secondary px-6 py-8',
        className,
      )}
    >
      <AlertCircle size={20} className="text-destructive" aria-hidden />
      <p className="max-w-[34ch] text-body leading-relaxed text-label-primary">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

/** Skeleton block — shimmer per interaction-spec.md §10. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton rounded-[var(--radius-block)]', className)} />;
}

/** Skeleton rows matching the eventual Habit Card shape. */
export function SkeletonCardList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading habits">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-[var(--radius-card)] bg-bg-secondary p-5"
        >
          <Skeleton className="size-12 rounded-[var(--radius-block)]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-9 w-12" />
        </div>
      ))}
    </div>
  );
}
