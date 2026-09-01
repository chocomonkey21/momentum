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
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const layoutId = useId();

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex w-full gap-1 rounded-[var(--radius-chip)] bg-bg-secondary p-1',
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
              'relative min-h-[36px] flex-1 rounded-[8px] px-3 py-2',
              'text-subheadline font-medium transition-colors',
              selected ? 'text-black' : 'text-label-primary hover:text-white',
            )}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                aria-hidden
                className="absolute inset-0 rounded-[8px] bg-white"
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
