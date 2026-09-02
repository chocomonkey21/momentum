'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { palette, semantic } from '@/theme/theme';
import { momentumSeries } from '@/lib/momentum';
import { dayKeyRange, toDayKey } from '@/lib/dates';
import type { HabitView } from '@/context/AppContext';

/**
 * Momentum Chart — arch bars.
 *
 * One bar per period, each the MEAN momentum across all active habits for
 * that period, drawn as a solid column with a fully rounded top. The value
 * is printed directly on the bar in black — the reference's tone-on-tone
 * numeral is 1.96:1 and unreadable at this size; amber marks the current
 * period instead. No axes, no
 * legend, no stacking — the previous stacked-segment chart put five hues in
 * every bar and was unreadable at phone width.
 *
 * Week view: 7 daily bars. Year view: 12 monthly bars (mean of that month's
 * daily means), which keeps the columns wide enough to carry a numeral.
 *
 * The numbers here come from the same `momentumSeries` replay the habit
 * cards use, so the chart can never disagree with the rows beside it
 * (user-flows.md §10). Aggregation is display-only.
 */
export function MomentumChart({ habits, days }: { habits: HabitView[]; days: number }) {
  const dayKeys = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    return dayKeyRange(toDayKey(start), toDayKey(end));
  }, [days]);

  // Per-day mean across habits (null days from the replay count as 0).
  const daily = useMemo(() => {
    const series = habits.map((h) => momentumSeries(h.logs, dayKeys));
    return dayKeys.map((key, i) => {
      const vals = series.map((s) => s[i] ?? 0);
      const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { key, value: Math.round(mean) };
    });
  }, [habits, dayKeys]);

  const bars = useMemo(() => {
    if (days <= 14) {
      return daily.map((d) => ({
        id: d.key,
        label: format(new Date(d.key + 'T00:00:00'), 'EEEEE'),
        long: format(new Date(d.key + 'T00:00:00'), 'EEEE d MMMM'),
        value: d.value,
      }));
    }
    // Group by month, oldest first; twelve buckets for a year.
    const buckets = new Map<string, { sum: number; n: number; first: string }>();
    for (const d of daily) {
      const m = d.key.slice(0, 7);
      const b = buckets.get(m) ?? { sum: 0, n: 0, first: d.key };
      b.sum += d.value;
      b.n += 1;
      buckets.set(m, b);
    }
    // A 365-day window straddles thirteen calendar months; keep the twelve
    // most recent so the year reads as one bar per month, current month last.
    return [...buckets.entries()].slice(-12).map(([m, b]) => ({
      id: m,
      label: format(new Date(b.first + 'T00:00:00'), 'MMMMM'),
      long: format(new Date(b.first + 'T00:00:00'), 'MMMM yyyy'),
      value: Math.round(b.sum / b.n),
    }));
  }, [daily, days]);

  const last = bars.length - 1;
  const best = bars.reduce((a, b) => (b.value > a.value ? b : a), bars[0] ?? { value: 0, long: '' });

  const summary =
    habits.length === 0
      ? 'Momentum chart, no habits yet.'
      : `Average momentum over the last ${days} days across ${habits.length} habits. Highest was ${
          best.value
        } on ${best.long}; now ${bars[last]?.value ?? 0}.`;

  // Wide enough for a numeral on every bar in week view; year view keeps the
  // numeral only on the current bar, and every bar still carries a title.
  const showAll = bars.length <= 8;

  return (
    <div>
      <div role="img" aria-label={summary} className="flex h-56 items-end gap-2">
        {bars.map((b, i) => {
          const current = i === last;
          const fill = current ? palette.amber : palette.vermillion;
          const ink = palette.ink0;
          // Every bar keeps at least a full arch of height so a 0 still
          // reads as a shape, not a gap.
          const heightPct = Math.max(14, (b.value / 100) * 100);
          return (
            <div key={b.id} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${b.long}: ${b.value}`}>
              <div
                className="relative flex w-full items-start justify-center rounded-t-[var(--radius-pill)] pt-3 transition-[height] duration-500 ease-out"
                style={{ height: `${heightPct}%`, backgroundColor: fill }}
              >
                {(showAll || current) && (
                  <span
                    className="font-display-hero leading-none"
                    style={{ color: ink, fontSize: showAll ? 18 : 14 }}
                  >
                    {b.value}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Baseline + period labels, directly under each bar. */}
      <div className="mt-2 flex gap-2 border-t pt-2" style={{ borderColor: semantic.separator }}>
        {bars.map((b, i) => (
          <span
            key={b.id}
            aria-hidden
            className="font-data flex-1 text-center"
            style={{ color: i === last ? palette.amber : semantic.labelTertiary }}
          >
            {b.label}
          </span>
        ))}
      </div>

      {/* The chart is an image for assistive tech; the values live here too. */}
      <ul className="sr-only">
        {bars.map((b) => (
          <li key={b.id}>
            {b.long}: {b.value}
          </li>
        ))}
      </ul>
    </div>
  );
}
