'use client';

import type { LucideIcon } from 'lucide-react';
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/cn';

/**
 * The required states from CLAUDE.md §14, as reusable primitives so every
 * list-bearing screen shows the same thing rather than reimplementing it.
 */

/** Empty State — lucide icon + one line of body copy + one primary action. */
export function EmptyState({
  icon: Icon,
  message,
  actionLabel,
  onAction,
  className,
}: {
  icon: LucideIcon;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-[var(--radius-card)]',
        'bg-bg-secondary px-6 py-12 text-center',
        className,
      )}
    >
      {/* Zero is neutral, not an error — never destructive red here
          (design-system.md §1.2, CLAUDE.md §4). */}
      <Icon size={32} strokeWidth={2} className="text-label-secondary" aria-hidden />
      <p className="max-w-xs text-body text-label-secondary">{message}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-1">
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
        'flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)]',
        'bg-bg-secondary px-6 py-10 text-center',
        className,
      )}
    >
      <AlertCircle size={28} className="text-destructive" aria-hidden />
      <p className="max-w-sm text-body text-label-primary">{message}</p>
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
  return <div aria-hidden className={cn('skeleton rounded-[var(--radius-chip)]', className)} />;
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
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="size-11 rounded-full" />
        </div>
      ))}
    </div>
  );
}
