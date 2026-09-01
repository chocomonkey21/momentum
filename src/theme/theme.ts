/**
 * theme.ts — typed token values for anything Tailwind's CSS-first config can't
 * express directly (design-system.md §10): chart series colors passed to
 * Recharts as props, SVG stroke colors, and Framer Motion spring configs.
 *
 * Tailwind v4 uses a CSS-first `@theme` block (src/app/globals.css) rather than
 * a tailwind.config.ts — the token VALUES below are mirrored from that block and
 * are the single source of truth for anything consumed from TypeScript.
 */

export const palette = {
  blue: '#0A84FF',
  green: '#30D158',
  orange: '#FF9F0A',
  red: '#FF453A',
  yellow: '#FFD60A',
  purple: '#BF5AF2',
  // See globals.css: documented gap-fill for the "pink" named in §1's curated set.
  pink: '#FF375F',
  gray1: '#8E8E93',
  gray2: '#636366',
  gray3: '#48484A',
  gray4: '#3A3A3C',
  gray5: '#2C2C2E',
  gray6: '#1C1C1E',
  black: '#000000',
  white: '#FFFFFF',
} as const;

export const semantic = {
  tint: palette.blue,
  positive: palette.green,
  warning: palette.orange,
  destructive: palette.red,
  bgPrimary: palette.black,
  bgSecondary: palette.gray6,
  bgTertiary: palette.gray5,
  labelPrimary: palette.white,
  labelSecondary: palette.gray1,
  separator: 'rgba(58,58,60,0.5)',
} as const;

/**
 * Curated data-visualization set (design-system.md §1.2 exception).
 * A habit's chartColor is assigned round-robin from this list at creation and is
 * stable across the Overlapping Momentum Chart, Mood Calendar, and trend rows.
 * Do NOT generate arbitrary per-habit hues.
 */
export const CHART_COLORS = ['blue', 'green', 'orange', 'purple', 'pink'] as const;
export type ChartColor = (typeof CHART_COLORS)[number];

export function chartHex(c: ChartColor): string {
  return palette[c];
}

/**
 * Mood → color mapping for the Mood Calendar (design-system.md §8).
 * 5-point scale from data-model.md §3, mapped onto the same curated palette.
 * Unlogged days render as gray5.
 */
export const MOOD_COLORS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: palette.purple,
  2: palette.blue,
  3: palette.gray1,
  4: palette.orange,
  5: palette.green,
};

export const MOOD_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Rough',
  2: 'Low',
  3: 'Okay',
  4: 'Good',
  5: 'Great',
};

export const UNLOGGED_DAY_COLOR = palette.gray5;

/** Motion — design-system.md §5. Numeric configs, not "close enough". */
export const spring = {
  /** Critically damped, no bounce. Default for all standard UI. */
  default: { type: 'spring', damping: 20, stiffness: 200, mass: 1 },
  /** Slight bounce — momentum-driven/celebratory moments ONLY. */
  bouncy: { type: 'spring', damping: 12, stiffness: 180, mass: 1 },
} as const;

/** Reduced-motion fallback: 150–200ms opacity cross-fade (interaction-spec.md preamble). */
export const reducedFade = { duration: 0.175, ease: 'easeOut' } as const;

/** Fixed nav dimensions — used to guarantee scroll padding clears the nav.
 *  design-system.md §3: every scrollable list needs bottom padding >= nav height + 16. */
export const NAV = {
  tabBarHeight: 64,
  bottomClearance: 80, // 64 + 16
  sidebarWidth: 240,
} as const;
