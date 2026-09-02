'use client';

/**
 * Home / Today (ui-spec.md §4) — the daily landing screen.
 *
 * Direction B ("Arc / Raycast"), chosen over a Linear-style monochrome pass.
 *
 * Bold, warm and generous. The hero numeral is 96px and sits in a large
 * rounded card; the two stat tiles are solid blocks of tint blue and amber;
 * each habit is a full colour block in its own hue the moment it's done.
 * Whitespace is spent deliberately — 16px between groups, 32px before the
 * habit list — so the colour blocks have room to breathe. Radius steps
 * down from card (24) to block (14) to pill so nesting reads correctly.
 *
 * Presentational only —
 * screens own data and pass callbacks down (CLAUDE.md §6).
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, User, ArrowRight, Flame, Sparkles } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Screen, PageFade } from '@/components/ui/Screen';
import { IconButton } from '@/components/ui/Button';
import { EmptyState, ErrorState, SkeletonCardList, Skeleton } from '@/components/ui/States';
import { HabitCard } from '@/components/habit/HabitCard';
import { AddHabitSheet } from '@/components/habit/AddHabitSheet';
import { ConfirmDialog } from '@/components/ui/Sheet';
import { greeting, longDate } from '@/lib/dates';
import { chartHex, chartAlpha, palette, semantic } from '@/theme/theme';
import { cn } from '@/lib/cn';
import type { HabitView } from '@/context/AppContext';

export default function HomePage() {
  const router = useRouter();
  const { status, errorMessage, retry, userName, habits, setCompletion, addHabit, removeHabit } =
    useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<HabitView | null>(null);

  const todays = useMemo(() => habits.filter((h) => h.isDueToday), [habits]);
  const done = todays.filter((h) => h.todayLog?.completed === 1).length;
  const total = todays.length;
  const momentum = useMemo(
    () =>
      habits.length
        ? Math.round(habits.reduce((s, h) => s + h.momentumScore, 0) / habits.length)
        : 0,
    [habits],
  );
  const bestStreak = useMemo(() => habits.reduce((m, h) => Math.max(m, h.streak), 0), [habits]);
  const allDone = total > 0 && done === total;
  const loading = status === 'loading';

  return (
    <Screen className="pt-8">
      <PageFade>
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-data text-label-tertiary">{longDate()}</p>
            <h1 className="font-display mt-3 text-[40px] leading-[0.98]">
              {greeting()},<br />
              {userName}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <IconButton
              label="Open your profile"
              className="bg-bg-secondary"
              onClick={() => router.push('/profile')}
            >
              <User size={20} aria-hidden />
            </IconButton>
            <IconButton
              label="Add a habit"
              className="bg-white text-black hover:bg-white"
              onClick={() => setAddOpen(true)}
            >
              <Plus size={22} aria-hidden />
            </IconButton>
          </div>
        </header>

        {status === 'error' ? (
          <ErrorState message={errorMessage ?? 'Something went wrong.'} onRetry={retry} />
        ) : (
          <div className="flex flex-col gap-4">
            <section
              className="rounded-[var(--radius-card)] p-6 transition-colors"
              style={{
                backgroundColor: allDone ? palette.amber : semantic.bgSecondary,
                color: allDone ? palette.ink0 : undefined,
              }}
            >
              <p className={cn('font-data', allDone ? 'text-black/60' : 'text-label-tertiary')}>
                Today
              </p>
              {loading ? (
                <Skeleton className="mt-4 h-24 w-40" />
              ) : (
                <>
                  <div className="mt-4 flex items-end gap-3">
                    <span className="font-display-hero text-[96px] leading-[0.8]">{done}</span>
                    <span
                      className={cn(
                        'font-display-hero pb-1 text-[32px] leading-none',
                        allDone ? 'text-black/50' : 'text-label-tertiary',
                      )}
                    >
                      /{total}
                    </span>
                  </div>
                  <p
                    className={cn(
                      'mt-4 text-body',
                      allDone ? 'text-black/70' : 'text-label-secondary',
                    )}
                  >
                    {total === 0
                      ? 'Nothing scheduled today'
                      : allDone
                        ? 'Every habit done. A full day.'
                        : `${total - done} still to go`}
                  </p>
                  {total > 0 && (
                    <ul className="mt-6 flex gap-2" aria-hidden>
                      {todays.map((h) => (
                        <li
                          key={h.id}
                          className="h-3 flex-1 rounded-[var(--radius-pill)] transition-colors"
                          style={{
                            backgroundColor:
                              h.todayLog?.completed === 1
                                ? chartHex(h.chartColor)
                                : chartAlpha(h.chartColor, 0.18),
                          }}
                        />
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => router.push('/stats')}
                aria-label={`Overall momentum ${momentum} of 100. Open statistics.`}
                className="rounded-[var(--radius-card)] p-5 text-left"
                style={{ backgroundColor: semantic.tint }}
              >
                <p className="font-data text-white">Momentum</p>
                <p className="font-display-hero mt-3 text-[44px] leading-none text-white">
                  {loading ? '—' : momentum}
                </p>
                <p className="mt-2 text-footnote text-white">across {habits.length} habits</p>
              </button>
              <div
                className="rounded-[var(--radius-card)] p-5"
                style={{ backgroundColor: palette.amber }}
              >
                <p className="font-data text-black/60">Best streak</p>
                <p className="font-display-hero mt-3 flex items-center gap-2 text-[44px] leading-none text-black">
                  {loading ? '—' : bestStreak}
                  <Flame size={22} className="text-black/70" aria-hidden />
                </p>
                <p className="mt-2 text-footnote text-black/60">
                  {bestStreak === 1 ? 'day running' : 'days running'}
                </p>
              </div>
            </div>

            <Link
              href="/recap"
              className="flex min-h-[56px] items-center gap-4 rounded-[var(--radius-card)] bg-bg-secondary px-5 py-4 transition-colors hover:bg-bg-tertiary"
            >
              <span className="flex-1">
                <span className="font-data block text-label-tertiary">This week</span>
                <span className="mt-1 block text-headline font-medium">Your recap is ready</span>
              </span>
              <span className="inline-flex size-9 items-center justify-center rounded-[var(--radius-pill)] bg-white text-black">
                <ArrowRight size={16} aria-hidden />
              </span>
            </Link>

            <section className="mt-4">
              <h2 className="font-display mb-4 text-title2">Today&rsquo;s Habits</h2>
              {loading ? (
                <SkeletonCardList rows={3} />
              ) : todays.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  message={
                    habits.length === 0
                      ? "No habits yet. Momentum starts with one — it doesn't have to be a big one."
                      : 'Nothing scheduled for today. Enjoy the gap.'
                  }
                  actionLabel={habits.length === 0 ? 'Add your first habit' : undefined}
                  onAction={habits.length === 0 ? () => setAddOpen(true) : undefined}
                />
              ) : (
                <ul className="flex flex-col gap-3">
                  {todays.map((habit) => (
                    <li key={habit.id}>
                      <HabitCard
                        habit={habit}
                        onToggle={setCompletion}
                        onOpen={(id) => router.push(`/habits/${id}`)}
                        onDelete={() => setPendingDelete(habit)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </PageFade>
      <AddHabitSheet open={addOpen} onOpenChange={setAddOpen} onSubmit={addHabit} />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.name ?? 'this habit'}?`}
        body="Your history will be kept, but it will be removed from your active list."
        confirmLabel="Delete"
        onConfirm={() => {
          if (pendingDelete) void removeHabit(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </Screen>
  );
}
