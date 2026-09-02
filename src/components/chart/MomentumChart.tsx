'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { chartHex, palette, semantic } from '@/theme/theme';
import { momentumSeries } from '@/lib/momentum';
import { dayKeyRange, toDayKey } from '@/lib/dates';
import type { HabitView } from '@/context/AppContext';

/**
 * Stacked Momentum Chart.
 *
 * Replaces the earlier overlapping area chart with the stacked-bar treatment
 * from the design reference: one thin bar per day, segmented by habit, warm
 * ramp climbing from amber at the base to vermillion at the top.
 *
 * A note on the semantics, because stacking is easy to get wrong: each segment
 * is that habit's own momentum for that day, so the segments are independent —
 * stacking them is a legitimate *sum* ("total momentum across all habits"), not
 * a proportion. The Y axis is therefore 0 to 100 x habitCount. Each habit's
 * segment height still equals the number on its own card, so the chart can
 * never disagree with the rows beside it (user-flows.md §10).
 */
export function MomentumChart({ habits, days }: { habits: HabitView[]; days: number }) {
  const dayKeys = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    return dayKeyRange(toDayKey(start), toDayKey(end));
  }, [days]);

  const data = useMemo(() => {
    const series = habits.map((h) => ({ habit: h, values: momentumSeries(h.logs, dayKeys) }));
    return dayKeys.map((key, i) => {
      const row: Record<string, string | number> = { date: key };
      for (const s of series) row[`h${s.habit.id}`] = s.values[i] ?? 0;
      return row;
    });
  }, [habits, dayKeys]);

  const ceiling = Math.max(100, habits.length * 100);

  const summary = useMemo(() => {
    if (habits.length === 0) return 'Momentum chart, no habits yet.';
    const best = habits.reduce((a, b) => (b.momentumScore > a.momentumScore ? b : a));
    return `Stacked momentum chart over the last ${days} days, ${habits.length} habits. Highest is ${
      best.name
    } at ${Math.round(best.momentumScore)} out of 100.`;
  }, [habits, days]);

  return (
    <div>
      {/* Legend: a solid swatch per habit, in the same hue as its bar. */}
      <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-2">
        {habits.map((h) => (
          <li key={h.id} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 rounded-[3px]"
              style={{ backgroundColor: chartHex(h.chartColor) }}
            />
            <span className="font-data text-[10px] text-label-secondary">{h.name}</span>
          </li>
        ))}
      </ul>

      <div role="img" aria-label={summary} className="h-56 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="18%">
            <CartesianGrid stroke={palette.ink3} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) =>
                days <= 14
                  ? format(new Date(v + 'T00:00:00'), 'd')
                  : format(new Date(v + 'T00:00:00'), 'd MMM')
              }
              tick={{
                fill: semantic.labelTertiary,
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                letterSpacing: 0.5,
              }}
              axisLine={false}
              tickLine={false}
              minTickGap={days <= 14 ? 4 : 24}
            />
            <YAxis
              domain={[0, ceiling]}
              ticks={[0, ceiling / 2, ceiling]}
              tick={{
                fill: semantic.labelTertiary,
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
              }}
              axisLine={false}
              tickLine={false}
              width={34}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              contentStyle={{
                backgroundColor: semantic.bgElevated,
                border: `1px solid ${semantic.separator}`,
                borderRadius: 14,
                fontSize: 12,
                fontFamily: 'var(--font-sans)',
              }}
              labelStyle={{
                color: semantic.labelSecondary,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
              labelFormatter={(v) => format(new Date(String(v) + 'T00:00:00'), 'EEE d MMM')}
              formatter={(value, name) => {
                const key = String(name);
                const habit = habits.find((h) => `h${h.id}` === key);
                return [Math.round(Number(value ?? 0)), habit?.name ?? key];
              }}
            />

            {/* Rendered in palette order, so amber sits at the base of the stack
                and the warm ramp climbs through flat, solid segments. */}
            {habits.map((h, i) => (
              <Bar
                key={h.id}
                dataKey={`h${h.id}`}
                stackId="momentum"
                fill={chartHex(h.chartColor)}
                // Only the topmost segment gets rounded shoulders.
                radius={i === habits.length - 1 ? [3, 3, 0, 0] : undefined}
                isAnimationActive
                animationDuration={450}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
