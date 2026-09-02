'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { forwardRef } from 'react';
import { cn } from '@/lib/cn';
import { spring, reducedFade } from '@/theme/theme';

type Variant = 'primary' | 'secondary' | 'outlined' | 'destructive';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Renders a spinner and blocks interaction — used for the brief write on submit. */
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-tint text-white hover:brightness-110',
  secondary: 'bg-transparent text-label-primary border-2 border-white/30 hover:border-white/60',
  outlined: 'bg-transparent text-label-primary border-2 border-white/30 hover:border-white/60',
  destructive: 'bg-destructive text-white hover:brightness-110',
};

/**
 * Primary Button — pill, tint bg, black label, Headline weight, 50px height
 * (design-system.md §7). Press-down scale to 0.97 (interaction-spec.md §1).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading = false, fullWidth = false, className, children, disabled, ...rest },
  ref,
) {
  const reduce = useReducedMotion();
  const isDisabled = disabled || loading;

  return (
    <motion.button
      ref={ref}
      type="button"
      disabled={isDisabled}
      // Press-down, not release (interaction-spec.md §1 / design-system.md §5).
      whileTap={isDisabled ? undefined : reduce ? { opacity: 0.7 } : { scale: 0.97 }}
      transition={reduce ? reducedFade : spring.default}
      className={cn(
        // Pill — the roundest thing in the system, because it is the thing you press.
        'inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[var(--radius-pill)] px-7',
        // Condensed-bold uppercase label: the button reads as a badge you
        // press, which is the playful register the whole app now speaks in.
        'font-display text-[17px] uppercase tracking-[0.04em] transition-colors',
        // Disabled is visually distinct, not merely non-functional (CLAUDE.md §14).
        'disabled:cursor-not-allowed disabled:opacity-40',
        VARIANTS[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </motion.button>
  );
});

/** Icon-only control. `label` is required and becomes the aria-label (CLAUDE.md §9). */
export function IconButton({
  label,
  children,
  className,
  ...rest
}: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      whileTap={reduce ? { opacity: 0.7 } : { scale: 0.94 }}
      transition={reduce ? reducedFade : spring.default}
      // 44x44 minimum hit area — pad the target, don't enlarge the glyph.
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-pill)]',
        'text-label-primary transition-colors hover:bg-bg-tertiary',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}
