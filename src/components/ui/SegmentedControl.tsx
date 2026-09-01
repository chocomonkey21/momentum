'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useId } from 'react';
import { cn } from '@/lib/cn';
import { spring, reducedFade } from '@/theme/theme';

/**
 * Segmented Control (design-system.md §7).
 *
 * Audit fix, called out in ui-spec.md §5 and §11: the label must always render
 * visibly. The selected label is explicitly `text-black` on the tint-free white
 * indicator and unselected labels are `text-label-primary` — never white on
 * white, which was the original bug.
 *
 * The indicator SLIDES between positions as one element (interaction-spec.md §6)
 * via a shared layoutId, rather than cross-fading two separate backgrounds.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  variant = 'solid',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
  /**
   * 'solid' is the primary white-indicator control. 'ghost' is for a SECOND
   * control stacked under a solid one — two full-strength white pills in a row
   * out-shout the coloured content they sit above, so the subordinate one gets
   * a quieter indicator and smaller type to keep the hierarchy readable.
   */
  variant?: 'solid' | 'ghost';
}) {
  const reduce = useReducedMotion();
  const layoutId = useId();

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex w-full gap-1 rounded-[var(--radius-chip)] p-1',
        variant === 'solid' ? 'bg-bg-secondary' : 'bg-white/[0.04]',
        className,
      )}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative flex-1 rounded-[9px] px-3 transition-colors',
              variant === 'solid'
                ? 'min-h-[38px] py-2 text-subheadline font-semibold tracking-[-0.01em]'
                : 'min-h-[32px] py-1.5 text-footnote font-semibold tracking-[0.01em]',
              selected
                ? variant === 'solid'
                  ? 'text-black'
                  : 'text-label-primary'
                : 'text-label-secondary hover:text-label-primary',
            )}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                aria-hidden
                className={cn(
                  'absolute inset-0 rounded-[9px]',
                  variant === 'solid' ? 'bg-white' : 'bg-white/12',
                )}
                transition={reduce ? reducedFade : spring.default}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
