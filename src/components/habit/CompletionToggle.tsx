'use client';

import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { spring, reducedFade, semantic } from '@/theme/theme';

/**
 * The signature micro-interaction (interaction-spec.md §3) — the moment the
 * momentum mechanic becomes visible.
 *
 * 1. The toggle fills on PRESS-DOWN, optimistically, without waiting for the
 *    IndexedDB write to resolve.
 * 2. A glow + scale pulse confirms the action registered.
 * 3. Un-completing plays the same change in reverse with NO celebration — undo
 *    should feel neutral, not punishing.
 * 4. Interruptible: rapid toggling never queues animations; each press animates
 *    from the toggle's current live state.
 *
 * The paired Momentum Ring animation lives in MomentumRing.tsx, which reads the
 * new score and animates to it over ~500ms.
 */
export function CompletionToggle({
  completed,
  onToggle,
  habitName,
  locked = false,
  lockedReason,
  size = 44,
}: {
  completed: boolean;
  onToggle: (next: boolean) => void;
  habitName: string;
  /** Time-constraint lockout (data-model.md §4.3). */
  locked?: boolean;
  lockedReason?: string;
  size?: number;
}) {
  const reduce = useReducedMotion();
  // Optimistic local state so the fill is instant regardless of write latency.
  const [optimistic, setOptimistic] = useState(completed);
  const [pulse, setPulse] = useState(false);

  // Re-sync if the underlying data changes from elsewhere (e.g. Log Habit sheet).
  useEffect(() => setOptimistic(completed), [completed]);

  const isOn = optimistic;

  function press() {
    if (locked) return;
    const next = !optimistic;
    setOptimistic(next);
    // Celebratory pulse on completion only, never on undo (§3).
    if (next && !reduce) {
      setPulse(true);
      setTimeout(() => setPulse(false), 450);
    }
    onToggle(next);
  }

  if (locked) {
    return (
      <span
        // Disabled state is visually distinct AND not focusable (CLAUDE.md §14).
        aria-hidden="true"
        title={lockedReason}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full',
          'border-2 border-gray4 bg-bg-tertiary opacity-40',
        )}
        style={{ width: size, height: size }}
      >
        <Lock size={18} className="text-label-secondary" />
      </span>
    );
  }

  return (
    <motion.button
      type="button"
      // Explicit, spoken label — ui-spec.md §4 focus requirement.
      aria-label={isOn ? `Mark ${habitName} incomplete` : `Mark ${habitName} complete`}
      aria-pressed={isOn}
      // Respond to press-down, not release (design-system.md §5).
      onPointerDown={(e) => {
        e.preventDefault();
        press();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          press();
        }
      }}
      animate={pulse ? { scale: [1, 1.18, 1] } : { scale: 1 }}
      transition={reduce ? reducedFade : spring.bouncy}
      whileHover={reduce ? undefined : { scale: 1.06 }}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full',
        'border-2 transition-colors duration-200',
        isOn ? 'border-positive bg-positive' : 'border-gray3 bg-transparent hover:border-tint',
      )}
      style={{ width: size, height: size }}
    >
      {/* Glow ring — confirms registration without a haptic (web has none). */}
      <AnimatePresence>
        {pulse && (
          <motion.span
            aria-hidden
            initial={{ opacity: 0.55, scale: 1 }}
            animate={{ opacity: 0, scale: 1.7 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: `0 0 0 3px ${semantic.positive}` }}
          />
        )}
      </AnimatePresence>

      <motion.span
        initial={false}
        animate={{ opacity: isOn ? 1 : 0, scale: isOn ? 1 : 0.5 }}
        transition={reduce ? reducedFade : spring.default}
        className="flex items-center justify-center"
      >
        <Check size={size * 0.5} strokeWidth={3} className="text-black" aria-hidden />
      </motion.span>
    </motion.button>
  );
}
