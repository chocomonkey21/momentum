/**
 * theme.ts — typed token values for anything consumed from TypeScript
 * (Recharts props, SVG strokes, Framer Motion configs).
 *
 * Mirrors the `@theme` block in src/app/globals.css, which is the source of
 * truth for the CSS side. Tailwind v4 is CSS-first, so there is no
 * tailwind.config.ts.
 */

export const palette = {
  /* Data hues. Vermillion / amber / magenta are from the arch-chart
     reference, blue and green from the pill reference. Plum is a FILL-ONLY
     hue (1.97:1 on black) — onboarding tiles and avatars, never a habit. */
  amber: '#FFB627',
  vermillion: '#F4532B',
  plum: '#7A0F3F',
  magenta: '#FF2FB3',
  blue: '#0B6BFF',
  /* Status only — never assigned to a habit. */
  orange: '#FF7A00',

  green: '#34D058',
  crimson: '#FF2D55',

  ink0: '#000000',
  ink1: '#08080A',
  ink2: '#121214',
  ink3: '#1A1A1D',
  ink4: '#242428',
  ink5: '#33333A',
  ink6: '#52525C',
  ink7: '#8B8B96',
  ink8: '#C4C4CC',
  white: '#FFFFFF',
} as const;

export const semantic = {
  tint: palette.blue,
  positive: palette.green,
  warning: palette.orange,
  destructive: palette.crimson,
  bgPrimary: palette.ink0,
  bgSecondary: palette.ink2,
  bgTertiary: palette.ink4,
  bgElevated: palette.ink3,
  labelPrimary: palette.white,
  labelSecondary: palette.ink8,
  labelTertiary: palette.ink7,
  separator: 'rgba(255,255,255,0.07)',
} as const;

/**
 * Curated per-habit data-visualization set.
 *
 * Ordered as a warm ramp (amber → orange → vermillion) before the cool accents.
 * Every value is a flat, fully-saturated fill — these are used as whole-card
 * backgrounds, not as tints behind a neutral card.
 * A typical 3–4 habit account therefore renders the stacked momentum chart as a
 * warm yellow-to-red climb, while keeping enough hue separation for the
 * calendar and contribution grids to stay readable. Assigned round-robin at
 * creation and stable across every screen.
 */
export const CHART_COLORS = ['vermillion', 'amber', 'magenta', 'blue', 'green'] as const;
export type ChartColor = (typeof CHART_COLORS)[number];

/**
 * Habit rows persist their `chartColor` by name, so databases created before
 * the palette change still hold names that no longer exist in CHART_COLORS
 * ('green', 'pink', 'red'...). Everything that resolves a habit colour goes
 * through this first, so a pre-existing install degrades to the nearest current
 * hue instead of rendering `undefined` and losing its colour entirely.
 */
const LEGACY_COLOR_ALIASES: Record<string, ChartColor> = {
  pink: 'magenta',
  red: 'vermillion',
  yellow: 'amber',
  // Orange and cyan left the data set in v5; they map to the two hues that
  // keep a five-habit account visibly distinct.
  orange: 'magenta',
  cyan: 'green',
  plum: 'magenta',
  // Violet was dropped in v4 — the single most generic 'AI app' accent.
  purple: 'magenta',
};

export function normalizeChartColor(c: string): ChartColor {
  if ((CHART_COLORS as readonly string[]).includes(c)) return c as ChartColor;
  return LEGACY_COLOR_ALIASES[c] ?? 'blue';
}

export function chartHex(c: ChartColor): string {
  return palette[normalizeChartColor(c)];
}

/** Text colour that stays legible on a solid fill of the given habit hue. */
export function onChartHex(c: ChartColor): string {
  const n = normalizeChartColor(c);
  // Blue takes white (4.6:1); the light hues take black (amber 12:1,
  // vermillion 6.1:1, magenta 6.3:1, green 10.3:1).
  return n === 'blue' ? palette.white : palette.ink0;
}

/**
 * rgba() of a habit hue at a given alpha.
 *
 * Only used for the contribution grid's five-step intensity ramp, where each
 * step is still a flat fill — never for a gradient or a wash behind a card.
 */
export function chartAlpha(c: ChartColor, alpha: number): string {
  const hex = chartHex(c).replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Five-step intensity ramp for the GitHub-style contribution grid.
 * Index 0 is an unlogged day; 1–4 climb toward the habit's full hue.
 */
export function contributionRamp(c: ChartColor): [string, string, string, string, string] {
  return [
    palette.ink3,
    chartAlpha(c, 0.28),
    chartAlpha(c, 0.5),
    chartAlpha(c, 0.75),
    chartHex(c),
  ];
}

/** Mood → colour (design-system.md §8), restated on the bolder palette. */
export const MOOD_COLORS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: palette.crimson,
  2: palette.vermillion,
  3: palette.ink6,
  4: palette.orange,
  5: palette.amber,
};

export const MOOD_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Rough',
  2: 'Low',
  3: 'Okay',
  4: 'Good',
  5: 'Great',
};

export const UNLOGGED_DAY_COLOR = palette.ink3;

/** Motion — design-system.md §5. Numeric configs, not "close enough". */
export const spring = {
  /** Critically damped, no bounce. Default for all standard UI. */
  default: { type: 'spring', damping: 20, stiffness: 200, mass: 1 },
  /** Slight bounce — momentum-driven/celebratory moments ONLY. */
  bouncy: { type: 'spring', damping: 12, stiffness: 180, mass: 1 },
} as const;

/** Reduced-motion fallback: 150–200ms opacity cross-fade. */
export const reducedFade = { duration: 0.175, ease: 'easeOut' } as const;

export const NAV = {
  tabBarHeight: 64,
  bottomClearance: 80,
  sidebarWidth: 240,
} as const;

/**
 * Category → hue, for surfaces that colour by category rather than by habit
 * (onboarding tiles, the Add Habit category picker). Stable by name, cycling
 * the curated set, so "Fitness" is the same amber everywhere it appears.
 */
const CATEGORY_HUES: Record<string, ChartColor> = {
  Fitness: 'vermillion',
  Study: 'blue',
  Health: 'amber',
  Creativity: 'magenta',
  Mind: 'green',
  Lifestyle: 'amber',
  Work: 'blue',
};
export function categoryHue(name: string | null | undefined): ChartColor {
  if (!name) return 'blue';
  return CATEGORY_HUES[name] ?? CHART_COLORS[Math.abs(hashString(name)) % CHART_COLORS.length];
}
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
