'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { spring, reducedFade } from '@/theme/theme';

/** Static surface. card.bg + 16px radius (design-system.md §1.3, §3). */
export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-[var(--radius-card)] bg-bg-secondary p-5', className)}
      {...rest}
    />
  );
}

interface PressableCardProps extends React.HTMLAttributes<HTMLDivElement> {
  onActivate?: () => void;
  ariaLabel?: string;
}

/**
 * Interactive card. Press-down: scale 0.98 + background lightens one step
 * (interaction-spec.md §2). Hover (desktop only, via @media(hover:hover) in the
 * `hover:` variant): lift -2px + shadow (interaction-spec.md §15).
 */
export function PressableCard({
  className,
  onActivate,
  ariaLabel,
  children,
  ...rest
}: PressableCardProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate?.();
        }
      }}
      whileTap={reduce ? { opacity: 0.85 } : { scale: 0.98 }}
      whileHover={reduce ? undefined : { y: -2 }}
      transition={reduce ? reducedFade : spring.default}
      className={cn(
        'cursor-pointer rounded-[var(--radius-card)] bg-bg-secondary p-5',
        'transition-colors duration-150 hover:bg-bg-tertiary',
        className,
      )}
      {...(rest as React.ComponentProps<typeof motion.div>)}
    >
      {children}
    </motion.div>
  );
}
