'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen, Flame, Zap, Trophy, Dumbbell, Moon, Droplets, PenLine, Bike } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { palette } from '@/theme/theme';
import { cn } from '@/lib/cn';

/**
 * A constellation of outlined habit icons — the things people actually track:
 * reading, running, water, sleep, journaling, a win. They pop in with a
 * staggered spring and then drift very slowly, each on its own period, so
 * the group never looks synchronised.
 *
 * Every icon is a lucide outline in one hue from the data set, stroke only.
 * Under reduced-motion they render at rest.
 */
// Nine icons on a loose 3×3 grid: two rows above the wordmark, one below.
// The band from ~38% to ~70% is left empty for the wordmark and tagline.
const ICONS: { Icon: LucideIcon; hue: string; x: string; y: string; size: number; period: number }[] = [
  { Icon: BookOpen, hue: palette.magenta, x: '4%', y: '2%', size: 40, period: 6.5 },
  { Icon: PenLine, hue: palette.amber, x: '42%', y: '0%', size: 30, period: 5.5 },
  { Icon: Flame, hue: palette.vermillion, x: '78%', y: '3%', size: 36, period: 5.2 },
  { Icon: Droplets, hue: palette.blue, x: '20%', y: '20%', size: 30, period: 5.8 },
  { Icon: Dumbbell, hue: palette.blue, x: '54%', y: '19%', size: 38, period: 7.1 },
  { Icon: Moon, hue: palette.green, x: '88%', y: '22%', size: 28, period: 7.6 },
  { Icon: Zap, hue: palette.amber, x: '6%', y: '80%', size: 36, period: 4.9 },
  { Icon: Trophy, hue: palette.magenta, x: '42%', y: '78%', size: 40, period: 6.2 },
  { Icon: Bike, hue: palette.green, x: '78%', y: '80%', size: 38, period: 6.8 },
];

export function FloatingIcons({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0', className)}>
      {ICONS.map(({ Icon, hue, x, y, size, period }, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{ left: x, top: y, color: hue }}
          initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.4, rotate: -20 }}
          animate={
            reduce
              ? { opacity: 1 }
              : { opacity: 1, scale: 1, rotate: [i % 2 ? 8 : -8, i % 2 ? -8 : 8], y: [0, -10, 0] }
          }
          transition={
            reduce
              ? { duration: 0 }
              : {
                  opacity: { delay: 0.1 + i * 0.07, type: 'spring', damping: 12, stiffness: 180 },
                  scale: { delay: 0.1 + i * 0.07, type: 'spring', damping: 12, stiffness: 180 },
                  rotate: { delay: 0.6, duration: period * 1.3, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' },
                  y: { delay: 0.6, duration: period, repeat: Infinity, ease: 'easeInOut' },
                }
          }
        >
          <Icon size={size} strokeWidth={2} />
        </motion.span>
      ))}
    </div>
  );
}
