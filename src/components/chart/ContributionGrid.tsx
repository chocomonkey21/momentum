'use client';

import { useEffect, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/cn';
import { contributionRamp, type ChartColor } from '@/theme/theme';
import { momentumSeries } from '@/lib/momentum';
import { dayKeyRange, toDayKey } from '@/lib/dates';
import type { HabitLog } from '@/db/schema';

/**
 * Contribution grid — the GitHub activity-graph treatment, one column per week,
 * seven rows per column, coloured in the habit's own hue.
 *
 * Intensity is NOT binary done/not-done. A completed day is graded 1–4 by the
 * habit's momentum on that day, so the grid shows the shape of a run building
 * and decaying rather than a flat on/off mask — which is the whole point of a
 * decaying-momentum tracker and the reason this reads as more than a checkbox
 * calendar. Unlogged and missed days share the empty shade.
 */

const DAY_LABELS = ['', 'M', '', 'W', '', 'F', ''];

export function ContributionGrid({
  logs,
  color,
  weeks = 53,
  cell = 11,
  gap = 3,
  showMonths = true,
  showDays = true,
  className,
  label,
}: {
  logs: HabitLog[];
  color: ChartColor;
  /** Number of week columns to render, counting back from this week. */
  weeks?: number;
  cell?: number;
  gap?: number;
  showMonths?: boolean;
  showDays?: boolean;
  className?: string;
  /** Accessible name for the whole grid. */
  label: string;
}) {
  const ramp = contributionRamp(color);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Open on the most recent weeks, the way GitHub does. Without this a
  // year-wide grid starts scrolled to its oldest column, so any account younger
  // than a year shows a screenful of empty cells with the real data off-canvas.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks, logs]);

  const { columns, monthMarks, total } = useMemo(() => {
    // End on the Saturday of the current week so the last column is complete.
    const end = new Date();
    end.setDate(end.getDate() + (6 - end.getDay()));
    const start = new Date(end);
    start.setDate(start.getDate() - (weeks * 7 - 1));

    const keys = dayKeyRange(toDayKey(start), toDayKey(end));
    const byDate = new Map(logs.map((l) => [l.date, l]));
    const series = momentumSeries(logs, keys);
    const momentumByKey = new Map(keys.map((k, i) => [k, series[i]]));

    const cols: { key: string; level: number; date: string }[][] = [];
    let done = 0;

    for (let w = 0; w < weeks; w++) {
      const col: { key: string; level: number; date: string }[] = [];
      for (let d = 0; d < 7; d++) {
        const key = keys[w * 7 + d];
        if (!key) continue;
        const log = byDate.get(key);
        let level = 0;
        if (log?.completed === 1) {
          done += 1;
          const m = momentumByKey.get(key) ?? 50;
          const v = m ?? 50;
          level = v >= 75 ? 4 : v >= 50 ? 3 : v >= 25 ? 2 : 1;
        }
        col.push({ key, level, date: key });
      }
      cols.push(col);
    }

    // Month label sits above the first column that starts a new month.
    const marks: { index: number; label: string }[] = [];
    let lastMonth = -1;
    cols.forEach((col, i) => {
      const first = col[0];
      if (!first) return;
      const m = new Date(first.date + 'T00:00:00').getMonth();
      if (m !== lastMonth) {
        marks.push({ index: i, label: format(new Date(first.date + 'T00:00:00'), 'MMM') });
        lastMonth = m;
      }
    });

    return { columns: cols, monthMarks: marks, total: done };
  }, [logs, weeks]);

  const step = cell + gap;

  return (
    <figure className={cn('min-w-0', className)}>
      <div ref={scrollerRef} className="no-scrollbar overflow-x-auto">
        <div className="inline-flex flex-col gap-1">
          {showMonths && (
            <div className="relative h-3" style={{ width: columns.length * step }} aria-hidden>
              {monthMarks.map((m) => (
                <span
                  key={`${m.index}-${m.label}`}
                  className="font-data absolute top-0 text-[10px] text-label-tertiary"
                  style={{ left: m.index * step }}
                >
                  {m.label}
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-1">
            {showDays && (
              <div className="flex flex-col" style={{ gap }} aria-hidden>
                {DAY_LABELS.map((d, i) => (
                  <span
                    key={i}
                    className="font-data text-[10px] leading-none text-label-tertiary"
                    style={{ height: cell, lineHeight: `${cell}px`, width: 10 }}
                  >
                    {d}
                  </span>
                ))}
              </div>
            )}

            <div
              className="flex"
              style={{ gap }}
              role="img"
              aria-label={`${label}. ${total} completed days in this window.`}
            >
              {columns.map((col, ci) => (
                <div key={ci} className="flex flex-col" style={{ gap }}>
                  {col.map((d) => (
                    <span
                      key={d.key}
                      title={`${format(new Date(d.date + 'T00:00:00'), 'd MMM yyyy')} — ${
                        d.level === 0 ? 'not completed' : `completed, intensity ${d.level} of 4`
                      }`}
                      style={{
                        width: cell,
                        height: cell,
                        borderRadius: Math.max(2, Math.round(cell * 0.25)),
                        backgroundColor: ramp[d.level],
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}

/** The GitHub-style "Less → More" key. */
export function ContributionLegend({ color }: { color: ChartColor }) {
  const ramp = contributionRamp(color);
  return (
    <div className="flex items-center gap-1" aria-hidden>
      <span className="font-data text-[10px] text-label-tertiary">Less</span>
      {ramp.map((c, i) => (
        <span
          key={i}
          className="size-2.5 rounded-[3px]"
          style={{ backgroundColor: c }}
        />
      ))}
      <span className="font-data text-[10px] text-label-tertiary">More</span>
    </div>
  );
}
