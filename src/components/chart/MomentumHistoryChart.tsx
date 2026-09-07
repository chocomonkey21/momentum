'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { momentumSeries } from '@/lib/momentum';
import { dayKeyRange, toDayKey } from '@/lib/dates';
import type { HabitView } from '@/context/AppContext';
import { palette, semantic } from '@/theme/theme';

export function MomentumHistoryChart({ habits }: { habits: HabitView[] }) {
  const points = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    const keys = dayKeyRange(toDayKey(start), toDayKey(end));
    const series = habits.map((habit) => momentumSeries(habit.logs, keys));
    return keys.map((key, index) => {
      const values = series.map((line) => line[index]).filter((value): value is number => value !== null);
      return { key, value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null };
    });
  }, [habits]);

  const plotted = points.filter((point): point is { key: string; value: number } => point.value !== null);
  const path = plotted.map((point, index) => {
    const x = plotted.length <= 1 ? 0 : (index / (plotted.length - 1)) * 100;
    const y = 100 - point.value;
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-title2">Momentum over time</h2>
        <span className="font-data text-label-tertiary">30 days</span>
      </div>
      <div className="rounded-[var(--radius-card)] bg-bg-secondary p-5">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-48 w-full" role="img" aria-label="Thirty-day average momentum history">
          <line x1="0" x2="100" y1="30" y2="30" stroke={semantic.separator} strokeWidth="0.5" />
          <line x1="0" x2="100" y1="60" y2="60" stroke={semantic.separator} strokeWidth="0.5" />
          {path && <path d={path} fill="none" stroke={palette.amber} strokeWidth="2" vectorEffect="non-scaling-stroke" />}
        </svg>
        <div className="flex justify-between font-data text-label-tertiary">
          <span>{points[0] ? format(new Date(points[0].key + 'T00:00:00'), 'd MMM') : '—'}</span>
          <span>{points.at(-1) ? format(new Date(points.at(-1)!.key + 'T00:00:00'), 'd MMM') : '—'}</span>
        </div>
        <ul className="sr-only">
          {points.map((point) => <li key={point.key}>{point.key}: {point.value === null ? 'no data' : Math.round(point.value)}</li>)}
        </ul>
      </div>
    </div>
  );
}
