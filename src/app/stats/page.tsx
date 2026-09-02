'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, ChevronRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Screen, ScreenHeader, PageFade } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { MomentumChart } from '@/components/chart/MomentumChart';
import { InsightCard } from '@/components/habit/InsightCard';
import { aggregateInsight, MIN_LOGS_FOR_INSIGHT } from '@/lib/insights';
import { momentumBand } from '@/lib/momentum';
import { chartHex, semantic, palette } from '@/theme/theme';
import { Stat } from '@/components/ui/Stat';

type Range = 'week' | 'year';

const RANGES: { value: Range; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'year', label: 'Year' },
];

/**
 * Statistics (ui-spec.md §11) — the cross-habit dashboard.
 *
 * The headline aggregate is the MEAN of all active habits' momentumScore, and
 * is computed from exactly the same values as the per-habit rows underneath it
 * (user-flows.md §10). That's the direct fix for the audited bug where an "82%"
 * headline sat above four 100% rows.
 */
export default function StatsPage() {
  const router = useRouter();
  const { status, errorMessage, retry, habits, allLogs } = useApp();
  const [range, setRange] = useState<Range>('week');

  const days = range === 'week' ? 7 : 365;

  const overall = useMemo(() => {
    if (habits.length === 0) return 0;
    return Math.round(habits.reduce((sum, h) => sum + h.momentumScore, 0) / habits.length);
  }, [habits]);

  const insight = useMemo(() => aggregateInsight(allLogs), [allLogs]);

  if (status === 'error') {
    return (
      <Screen width="wide">
        <ScreenHeader title="Your Progress" />
        <ErrorState message={errorMessage ?? 'Something went wrong.'} onRetry={retry} />
      </Screen>
    );
  }

  return (
    <Screen width="wide">
      <PageFade>
        <ScreenHeader title="Your Progress" eyebrow="Statistics" />

        {status === 'loading' ? (
          <div className="flex flex-col gap-6">
            <Skeleton className="h-24 w-56" />
            <Skeleton className="h-72 w-full rounded-[var(--radius-card)]" />
            <Skeleton className="h-40 w-full rounded-[var(--radius-card)]" />
          </div>
        ) : habits.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            message="Nothing to chart yet. Add a habit and your momentum starts building from 50."
            actionLabel="Add your first habit"
            onAction={() => router.push('/habits')}
          />
        ) : (
          <div className="flex flex-col gap-6">
            {/* --- Chart column (two-thirds on desktop, ui-spec.md §11) --- */}
            <div>
              {/* The one hero number on this screen, in the app-wide stat
                  pattern: giant numeral, tiny uppercase label beneath. */}
              <section
                className="mb-4 rounded-[var(--radius-card)] p-6"
                // Strong momentum earns the green block; otherwise tint blue.
                style={{
                  backgroundColor:
                    momentumBand(overall) === 'strong' ? semantic.positive : semantic.tint,
                  color: momentumBand(overall) === 'strong' ? palette.ink0 : palette.white,
                }}
              >
                <Stat
                  size="xl"
                  value={overall}
                  label={`Overall momentum · ${habits.length} habit${habits.length === 1 ? '' : 's'}`}
                  labelClassName={
                    momentumBand(overall) === 'strong' ? '!text-current opacity-70' : '!text-current'
                  }
                />
              </section>

              <div className="mb-4">
                <SegmentedControl
                  options={RANGES}
                  value={range}
                  onChange={setRange}
                  ariaLabel="Chart time range"
                />
              </div>

              <section className="rounded-[var(--radius-card)] bg-bg-secondary p-5">
                <MomentumChart habits={habits} days={days} />
              </section>
            </div>

            {/* --- Sidebar column: per-habit rows + insight --- */}
            <div className="flex flex-col gap-4">
              <section>
                <h2 className="font-display mb-3 text-title2">By Habit</h2>
                <ul className="flex flex-col gap-2">
                  {habits.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => router.push(`/habits/${h.id}`)}
                        aria-label={`${h.name}, momentum ${Math.round(
                          h.momentumScore,
                        )} of 100. Open details.`}
                        className={[
                          'flex w-full min-h-[56px] items-center gap-3 rounded-[var(--radius-block)]',
                          'bg-bg-secondary px-4 py-3 text-left transition-colors hover:bg-bg-tertiary',
                        ].join(' ')}
                      >
                        {/* Solid chip in the habit's own hue — same colour it
                            carries in the chart, on its card, in its grid. */}
                        {/* Outlined ring in the habit's hue; numeral in the same hue. */}
                        <span
                          aria-hidden
                          className="size-4 shrink-0 rounded-[var(--radius-pill)] border-2"
                          style={{ borderColor: chartHex(h.chartColor) }}
                        />
                        <span className="min-w-0 flex-1 truncate text-subheadline">{h.name}</span>
                        <span
                          className="font-display-hero text-[24px] leading-none"
                          style={{ color: chartHex(h.chartColor) }}
                        >
                          {Math.round(h.momentumScore)}
                        </span>
                        <ChevronRight size={16} className="text-label-tertiary" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              {allLogs.length >= MIN_LOGS_FOR_INSIGHT && insight ? (
                <InsightCard text={insight} />
              ) : (
                <InsightCard
                  hint
                  text="Log a few days with mood and context tags and patterns start showing up here."
                />
              )}
            </div>
          </div>
        )}
      </PageFade>
    </Screen>
  );
}
