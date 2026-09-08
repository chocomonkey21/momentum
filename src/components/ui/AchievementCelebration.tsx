'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Award } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { palette } from '@/theme/theme';
import { POINTS_PER_ACHIEVEMENT } from '@/lib/achievements';

const BURST_HUES = [palette.amber, palette.vermillion, palette.magenta, palette.blue, palette.green];
const PARTICLES = 14;
const AUTO_DISMISS_MS = 3200;

/**
 * The Strava-style payoff moment. Fires app-wide, once, whenever
 * AppContext crosses an achievement threshold — habit completion (Home,
 * Habits list, Habit Detail, Log sheet) or a completed Pomodoro session
 * (Focus) all route through `notifyAchievementUnlocks`, so this is mounted
 * once in AuthGate rather than duplicated per screen.
 *
 * One flourish, gone in a beat: a radial burst of dots, a spring pop on the
 * badge, a count-up on the points. Under reduced-motion it's a plain fade —
 * still legible, no motion.
 */
export function AchievementCelebration() {
  const { celebration, dismissCelebration } = useApp();
  const reduce = useReducedMotion();
  const [points, setPoints] = useState(0);

  useEffect(() => {
    if (!celebration) return;
    if (reduce) {
      setPoints(POINTS_PER_ACHIEVEMENT);
      return;
    }
    setPoints(0);
    const start = performance.now();
    const duration = 600;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setPoints(Math.round(POINTS_PER_ACHIEVEMENT * t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [celebration, reduce]);

  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(dismissCelebration, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [celebration, dismissCelebration]);

  return (
    <AnimatePresence>
      {celebration && (
        <motion.div
          key="scrim"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={dismissCelebration}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 px-8"
        >
          <motion.div
            initial={reduce ? { opacity: 0 } : { scale: 0.6, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { scale: 0.9, opacity: 0 }}
            transition={reduce ? { duration: 0.2 } : { type: 'spring', damping: 14, stiffness: 220 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex w-full max-w-[340px] flex-col items-center gap-5 rounded-[var(--radius-sheet)] bg-bg-elevated px-8 py-10 text-center"
          >
            {!reduce && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
                {Array.from({ length: PARTICLES }).map((_, i) => {
                  const angle = (i / PARTICLES) * Math.PI * 2;
                  const radius = 90 + (i % 3) * 20;
                  return (
                    <motion.span
                      key={i}
                      className="absolute size-2 rounded-full"
                      style={{ backgroundColor: BURST_HUES[i % BURST_HUES.length] }}
                      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                      animate={{
                        x: Math.cos(angle) * radius,
                        y: Math.sin(angle) * radius,
                        opacity: 0,
                        scale: 0.4,
                      }}
                      transition={{ duration: 0.7, ease: 'easeOut', delay: 0.05 }}
                    />
                  );
                })}
              </div>
            )}

            <motion.span
              aria-hidden
              animate={reduce ? undefined : { scale: [1, 1.14, 1] }}
              transition={{ delay: 0.45, duration: 0.5 }}
              className="relative inline-flex size-20 items-center justify-center rounded-[var(--radius-pill)]"
              style={{ backgroundColor: palette.amber, color: palette.ink0 }}
            >
              <Award size={36} strokeWidth={2} />
            </motion.span>

            <div className="relative">
              <p className="font-data text-label-tertiary">Achievement Unlocked</p>
              <h2 className="font-display mt-2 text-[24px] leading-tight">{celebration.name}</h2>
              <p className="mt-1 text-footnote text-label-secondary">{celebration.description}</p>
            </div>

            <p className="font-display-hero relative text-[40px] leading-none" style={{ color: palette.amber }}>
              +{points}
              <span className="font-data ml-1 text-label-tertiary">pts</span>
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
