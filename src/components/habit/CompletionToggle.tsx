'use client';

import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { spring, reducedFade, palette } from '@/theme/theme';

/**
 * The signature micro-interaction (interaction-spec.md §3) — the moment the
 * momentum mechanic becomes visible.
 *
 * 1. Fills on PRESS-DOWN, optimistically, without waiting for the IndexedDB
 *    write to resolve.
 * 2. A glow + scale pulse confirms the action registered.
 * 3. Un-completing plays the same change in reverse with NO celebration — undo
 *    should feel neutral, not punishing.
 * 4. Interruptible: rapid toggling never queues animations.
 *
 * Visually this is now a squircle filled with the habit's own hue rather than a
 * neutral circle, so a completed card reads as a solid block of that habit's
 * colour at a glance.
 */
export function CompletionToggle({
  completed,
  onToggle,
  habitName,
  accent,
  onAccent = palette.white,
  locked = false,
  lockedReason,
  size = 48,
}: {
  completed: boolean;
  onToggle: (next: boolean) => void;
  habitName: string;
  /** The habit's hue — fills the toggle when complete. */
  accent: string;
  /** Legible check colour on top of `accent`. */
  onAccent?: string;
  locked?: boolean;
  lockedReason?: string;
  size?: number;
}) {
  const reduce = useReducedMotion();
  const [optimistic, setOptimistic] = useState(completed);
  const [pulse, setPulse] = useState(false);

  useEffect(() => setOptimistic(completed), [completed]);

  const isOn = optimistic;
  const radius = size / 2;

  function press() {
    if (locked) return;
    const next = !optimistic;
    setOptimistic(next);
    if (next && !reduce) {
      setPulse(true);
      setTimeout(() => setPulse(false), 450);
    }
    onToggle(next);
  }

  if (locked) {
    return (
      <span
        aria-hidden="true"
        title={lockedReason}
        className="inline-flex shrink-0 items-center justify-center border-2 border-ink5 bg-ink3 opacity-50"
        style={{ width: size, height: size, borderRadius: radius }}
      >
        <Lock size={size * 0.38} className="text-label-tertiary" />
      </span>
    );
  }

  return (
    <motion.button
      type="button"
      aria-label={isOn ? `Mark ${habitName} incomplete` : `Mark ${habitName} complete`}
      aria-pressed={isOn}
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
      animate={pulse ? { scale: [1.16, 1] } : { scale: 1 }}
      transition={reduce ? reducedFade : spring.bouncy}
      whileHover={reduce ? undefined : { scale: 1.05 }}
      className="relative inline-flex shrink-0 items-center justify-center border-2 transition-colors duration-200"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: isOn ? accent : 'rgba(255,255,255,0.04)',
        borderColor: isOn ? accent : 'rgba(255,255,255,0.18)',
      }}
    >
      <AnimatePresence>
        {pulse && (
          <motion.span
            aria-hidden
            initial={{ opacity: 0.5, scale: 1 }}
            animate={{ opacity: 0, scale: 1.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="absolute inset-0"
            style={{ borderRadius: radius, boxShadow: `0 0 0 3px ${accent}` }}
          />
        )}
      </AnimatePresence>

      <motion.span
        initial={false}
        animate={{ opacity: isOn ? 1 : 0, scale: isOn ? 1 : 0.4 }}
        transition={reduce ? reducedFade : spring.default}
        className="flex items-center justify-center"
      >
        <Check size={size * 0.46} strokeWidth={3.5} style={{ color: onAccent }} aria-hidden />
      </motion.span>
    </motion.button>
  );
}
