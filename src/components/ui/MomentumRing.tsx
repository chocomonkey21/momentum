'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { palette, semantic, spring, reducedFade } from '@/theme/theme';
import { momentumIsStrong } from '@/lib/momentum';

interface MomentumRingProps {
  /** 0–100 momentum score. */
  value: number;
  size?: number;
  strokeWidth?: number;
  /** Hero number treatment — the ONE display-face number on the screen. */
  hero?: boolean;
  label?: string;
  /** While true, the track renders but the fill is held at zero
   *  (interaction-spec.md §10 — never a spinner in place of the ring). */
  loading?: boolean;
  className?: string;
  /** Optional override for the fill color (used by the Pomodoro timer ring). */
  fillColor?: string;
  /** Suppresses the momentum-threshold celebration (e.g. for the focus timer). */
  celebrate?: boolean;
  /**
   * Set false when the caller renders its own centre content (the Pomodoro
   * timer draws its countdown digits there) — otherwise the ring's own value
   * renders underneath and the two overlap.
   */
  showValue?: boolean;
}

/**
 * The app's signature component (design-system.md §7).
 * - track = momentumRing.track (bg.tertiary), fill = tint, shifting to positive
 *   as the score climbs past 70 (design-system.md §1.3)
 * - animates between values over ~500ms rather than jump-cutting
 *   (interaction-spec.md §3.2)
 * - crossing 70 or hitting 100 fires a one-time scale pulse to 1.05 using the
 *   momentum-driven spring — the one place bounce is earned (§3.4)
 */
export function MomentumRing({
  value,
  size = 180,
  strokeWidth = 14,
  hero = true,
  label,
  loading = false,
  className,
  fillColor,
  celebrate = true,
  showValue = true,
}: MomentumRingProps) {
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const shown = loading ? 0 : clamped;
  const offset = circumference * (1 - shown / 100);

  const strong = momentumIsStrong(clamped);
  const stroke = fillColor ?? (strong ? semantic.positive : semantic.tint);

  // One-time pulse when the value crosses a meaningful threshold.
  const prev = useRef(clamped);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (!celebrate || loading) {
      prev.current = clamped;
      return;
    }
    const crossed70 = prev.current < 70 && clamped >= 70;
    const hit100 = prev.current < 100 && clamped >= 100;
    if (crossed70 || hit100) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      prev.current = clamped;
      return () => clearTimeout(t);
    }
    prev.current = clamped;
  }, [clamped, celebrate, loading]);

  return (
    <motion.div
      className={cn('relative inline-flex items-center justify-center', className)}
      animate={pulse && !reduce ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={reduce ? reducedFade : spring.bouncy}
    >
      <svg width={size} height={size} role="presentation" className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={palette.ink4}
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          // Framer reads the live value on interrupt, so rapid toggling never
          // queues or restarts from a hardcoded origin (interaction-spec.md §3).
          animate={{ strokeDashoffset: offset, stroke }}
          transition={reduce ? reducedFade : { duration: 0.5, ease: 'easeOut' }}
        />
      </svg>

      {showValue && (
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {loading ? (
          <span className="skeleton h-9 w-16 rounded-md" aria-hidden />
        ) : (
          <span
            className={cn(
              'tabular-nums leading-none',
              hero ? 'font-display-hero text-[56px]' : 'font-display text-title2',
            )}
          >
            {Math.round(clamped)}
          </span>
        )}
        {label && (
          <span className="font-data mt-1.5 text-[10px] text-label-tertiary">
            {label}
          </span>
        )}
      </div>
      )}
    </motion.div>
  );
}
