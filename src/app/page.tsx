'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Sparkles, User, ChevronRight, Flame } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Screen, PageFade } from '@/components/ui/Screen';
import { IconButton } from '@/components/ui/Button';
import { EmptyState, ErrorState, SkeletonCardList, Skeleton } from '@/components/ui/States';
import { HabitCard } from '@/components/habit/HabitCard';
import { AddHabitSheet } from '@/components/habit/AddHabitSheet';
import { ConfirmDialog } from '@/components/ui/Sheet';
import { greeting, longDate } from '@/lib/dates';
import { chartHex, chartAlpha, palette, semantic } from '@/theme/theme';
import type { HabitView } from '@/context/AppContext';

/**
 * Home / Today (ui-spec.md §4) — the daily landing screen.
 *
 * The hero is colour-blocked rather than a lone ring: a mega "done / due"
 * fraction, a pip row carrying one pip per habit due today in that habit's own
 * hue, and two filled stat tiles. Momentum still gets the most visual weight on
 * the screen (CLAUDE.md §3); the pip row is what makes the day's state readable
 * at a glance without parsing a single number.
 */
export default function HomePage() {
  const router = useRouter();
  const { status, errorMessage, retry, userName, habits, setCompletion, addHabit, removeHabit } =
    useApp();

  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<HabitView | null>(null);

  const todaysHabits = useMemo(() => habits.filter((h) => h.isDueToday), [habits]);
  const doneCount = todaysHabits.filter((h) => h.todayLog?.completed === 1).length;
  const total = todaysHabits.length;

  const overallMomentum = useMemo(() => {
    if (habits.length === 0) return 0;
    return Math.round(habits.reduce((s, h) => s + h.momentumScore, 0) / habits.length);
  }, [habits]);

  const bestStreak = useMemo(() => habits.reduce((m, h) => Math.max(m, h.streak), 0), [habits]);

  const allDone = total > 0 && doneCount === total;

  return (
    <Screen>
      <PageFade>
        <header className="mb-6 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-data text-[10px] text-label-tertiary">{longDate()}</p>
            <h1 className="font-display mt-2 text-large-title leading-[1.02]">
              {greeting()},<br />
              {userName}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {/* Profile isn't a tab, so it keeps a visible entry point here. */}
            <IconButton label="Open your profile" onClick={() => router.push('/profile')}>
              <User size={22} aria-hidden />
            </IconButton>
            <IconButton label="Add a habit" onClick={() => setAddOpen(true)}>
              <Plus size={24} aria-hidden />
            </IconButton>
          </div>
        </header>

        {status === 'error' ? (
          <ErrorState message={errorMessage ?? 'Something went wrong.'} onRetry={retry} />
        ) : (
          <div className="flex flex-col gap-3">
            {/* --- Hero: today's completion --- */}
            <section
              className="rounded-[var(--radius-card)] border p-6 transition-colors"
              style={{
                background: allDone
                  ? `linear-gradient(160deg, ${chartAlpha('amber', 0.24)} 0%, rgba(255,255,255,0.02) 65%)`
                  : semantic.bgSecondary,
                borderColor: allDone ? chartAlpha('amber', 0.4) : 'transparent',
              }}
            >
              <p className="font-data text-[10px] text-label-tertiary">Today</p>

              {status === 'loading' ? (
                <Skeleton className="mt-3 h-20 w-40" />
              ) : (
                <>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="font-display-hero text-[64px] leading-[0.82]">{doneCount}</span>
                    <span className="font-display pb-1.5 text-title2 text-label-secondary">
                      / {total}
                    </span>
                  </div>
                  <p className="mt-2 text-subheadline text-label-secondary">
                    {total === 0
                      ? 'Nothing scheduled today'
                      : allDone
                        ? 'Every habit done. That is a full day.'
                        : `${total - doneCount} still to go`}
                  </p>

                  {/* One pip per habit due today, in that habit's own hue. */}
                  {total > 0 && (
                    <ul className="mt-5 flex gap-1.5" aria-hidden>
                      {todaysHabits.map((h) => {
                        const done = h.todayLog?.completed === 1;
                        return (
                          <li
                            key={h.id}
                            className="h-2.5 flex-1 rounded-full transition-colors"
                            style={{
                              backgroundColor: done
                                ? chartHex(h.chartColor)
                                : chartAlpha(h.chartColor, 0.18),
                            }}
                          />
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </section>

            {/* --- Two filled stat tiles --- */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => router.push('/stats')}
                aria-label={`Overall momentum ${overallMomentum} of 100. Open statistics.`}
                className="rounded-[var(--radius-card)] p-5 text-left transition-transform hover:-translate-y-0.5"
                style={{ backgroundColor: semantic.tint }}
              >
                <p className="font-data text-[10px] text-white/70">Momentum</p>
                <p className="font-display-hero mt-2 text-[40px] leading-none text-white">
                  {status === 'loading' ? '—' : overallMomentum}
                </p>
                <p className="mt-1 text-footnote text-white/70">across {habits.length} habits</p>
              </button>

              <div
                className="rounded-[var(--radius-card)] p-5"
                style={{ backgroundColor: palette.amber }}
              >
                <p className="font-data text-[10px] text-black/60">Best streak</p>
                <p className="font-display-hero mt-2 flex items-center gap-1.5 text-[40px] leading-none text-black">
                  {status === 'loading' ? '—' : bestStreak}
                  <Flame size={22} className="text-black/70" aria-hidden />
                </p>
                <p className="mt-1 text-footnote text-black/60">
                  {bestStreak === 1 ? 'day running' : 'days running'}
                </p>
              </div>
            </div>

            {/* Weekly Recap entry point — a banner, deliberately not a tab
                (ui-spec.md §12). */}
            <Link
              href="/recap"
              className="flex min-h-[56px] items-center gap-3 rounded-[var(--radius-card)] bg-bg-secondary px-5 py-4 transition-colors hover:bg-bg-tertiary"
            >
              <span className="flex-1">
                <span className="font-data block text-[10px] text-label-tertiary">This week</span>
                <span className="mt-1 block text-subheadline">Your weekly recap is ready</span>
              </span>
              <ChevronRight size={18} className="text-label-secondary" aria-hidden />
            </Link>

            {/* --- Today's habits --- */}
            <section className="mt-4">
              <h2 className="font-display mb-3 text-title2">Today&rsquo;s Habits</h2>

              {status === 'loading' ? (
                <SkeletonCardList rows={3} />
              ) : todaysHabits.length === 0 ? (
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
                  {todaysHabits.map((habit) => (
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
