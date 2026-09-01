'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { chartHex, palette, semantic } from '@/theme/theme';
import { momentumSeries } from '@/lib/momentum';
import { dayKeyRange, toDayKey } from '@/lib/dates';
import type { HabitView } from '@/context/AppContext';

/**
 * Overlapping Momentum Chart (design-system.md §8).
 *
 * Each habit is a translucent (60% opacity) colored band on one shared time
 * axis and one shared Y axis (0–100), so multiple habits' momentum can be seen
 * rising and falling together. Bands are overlaid, NOT stacked — stacking would
 * make each habit's value depend on the others, which is not what momentum is.
 *
 * Colours come from each habit's stable `chartColor`, so a habit is the same
 * hue here, on its card, and in its calendar.
 */
export function MomentumChart({ habits, days }: { habits: HabitView[]; days: number }) {
  const dayKeys = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    return dayKeyRange(toDayKey(start), toDayKey(end));
  }, [days]);

  const data = useMemo(() => {
    const series = habits.map((h) => ({
      habit: h,
      values: momentumSeries(h.logs, dayKeys),
    }));
    return dayKeys.map((key, i) => {
      const row: Record<string, string | number | null> = { date: key };
      for (const s of series) row[`h${s.habit.id}`] = s.values[i];
      return row;
    });
  }, [habits, dayKeys]);

  // Accessible fallback — a line/area chart isn't meaningfully navigable
  // point-by-point by screen reader at this scope (ui-spec.md §11).
  const summary = useMemo(() => {
    if (habits.length === 0) return 'Momentum chart, no habits yet.';
    const best = habits.reduce((a, b) => (b.momentumScore > a.momentumScore ? b : a));
    return `Momentum chart over the last ${days} days, ${habits.length} habits. Highest is ${
      best.name
    } at ${Math.round(best.momentumScore)} out of 100.`;
  }, [habits, days]);

  return (
    <div role="img" aria-label={summary} className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        {/* No negative left margin: it pushed the "100" Y-axis tick outside the
            SVG viewport and rendered it clipped as "00". */}
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            {habits.map((h) => (
              <linearGradient key={h.id} id={`grad-${h.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartHex(h.chartColor)} stopOpacity={0.6} />
                <stop offset="100%" stopColor={chartHex(h.chartColor)} stopOpacity={0.05} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid stroke={palette.gray5} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => format(new Date(v + 'T00:00:00'), 'd MMM')}
            tick={{ fill: semantic.labelSecondary, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tick={{ fill: semantic.labelSecondary, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: semantic.bgSecondary,
              border: `1px solid ${semantic.separator}`,
              borderRadius: 12,
              fontSize: 13,
            }}
            labelStyle={{ color: semantic.labelSecondary }}
            labelFormatter={(v) => format(new Date(String(v) + 'T00:00:00'), 'EEEE, d MMM')}
            formatter={(value, name) => {
              const key = String(name);
              const habit = habits.find((h) => `h${h.id}` === key);
              return [Math.round(Number(value ?? 0)), habit?.name ?? key];
            }}
          />

          {habits.map((h) => (
            <Area
              key={h.id}
              type="monotone"
              dataKey={`h${h.id}`}
              stroke={chartHex(h.chartColor)}
              strokeWidth={2}
              fill={`url(#grad-${h.id})`}
              // Overlaid, not stacked — no stackId on purpose.
              connectNulls={false}
              dot={false}
              isAnimationActive
              animationDuration={500}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
