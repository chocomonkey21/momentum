'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Sparkles, User, CalendarDays, ChevronRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Screen, PageFade } from '@/components/ui/Screen';
import { IconButton } from '@/components/ui/Button';
import { MomentumRing } from '@/components/ui/MomentumRing';
import { EmptyState, ErrorState, SkeletonCardList, Skeleton } from '@/components/ui/States';
import { HabitCard } from '@/components/habit/HabitCard';
import { AddHabitSheet } from '@/components/habit/AddHabitSheet';
import { ConfirmDialog } from '@/components/ui/Sheet';
import { greeting, longDate } from '@/lib/dates';
import type { HabitView } from '@/context/AppContext';

/**
 * Home / Today (ui-spec.md §4) — the daily landing screen.
 *
 * Desktop (>=1024px) uses the two-column arrangement §4 specifies: the hero
 * snapshot sticky on the left, today's habit list scrolling on the right.
 */
export default function HomePage() {
  const router = useRouter();
  const {
    status,
    errorMessage,
    retry,
    userName,
    habits,
    setCompletion,
    addHabit,
    removeHabit,
  } = useApp();

  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<HabitView | null>(null);

  const todaysHabits = useMemo(() => habits.filter((h) => h.isDueToday), [habits]);
  const doneCount = todaysHabits.filter((h) => h.todayLog?.completed === 1).length;
  const total = todaysHabits.length;

  // The hero number is the share of today's habits completed. Zero is neutral —
  // it renders in tint/positive, never destructive red (CLAUDE.md §4).
  const todayPct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  return (
    <Screen width="wide">
      <PageFade>
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-subheadline text-label-secondary">{longDate()}</p>
            <h1 className="mt-1 text-large-title font-bold leading-tight">
              {greeting()}, {userName}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            {/* Profile keeps a visible entry point on mobile, where it isn't a
                tab — no orphaned screens (CLAUDE.md §3). */}
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
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
            {/* --- Hero snapshot: the largest number on the screen --- */}
            <section className="lg:sticky lg:top-6">
              <button
                type="button"
                onClick={() => router.push('/stats')}
                aria-label={`Today: ${doneCount} of ${total} habits done. Open statistics.`}
                className={[
                  'flex w-full flex-col items-center gap-4 rounded-[var(--radius-card)]',
                  'bg-bg-secondary p-6 transition-colors hover:bg-bg-tertiary',
                ].join(' ')}
              >
                <MomentumRing
                  value={todayPct}
                  loading={status === 'loading'}
                  label="Today"
                  size={168}
                />
                <div className="text-center">
                  {status === 'loading' ? (
                    <Skeleton className="mx-auto h-5 w-40" />
                  ) : (
                    <>
                      <p className="text-headline font-semibold">
                        {total === 0
                          ? 'Nothing scheduled today'
                          : `${doneCount} of ${total} habits done today`}
                      </p>
                      <p className="mt-1 text-footnote text-label-secondary">
                        Tap for your full progress
                      </p>
                    </>
                  )}
                </div>
              </button>

              {/* Weekly Recap entry point — a banner, deliberately not a 6th tab
                  (ui-spec.md §12). */}
              <Link
                href="/recap"
                className={[
                  'mt-3 flex min-h-[44px] items-center gap-3 rounded-[var(--radius-card)]',
                  'bg-bg-secondary px-5 py-4 transition-colors hover:bg-bg-tertiary',
                ].join(' ')}
              >
                <CalendarDays size={20} className="text-tint" aria-hidden />
                <span className="flex-1 text-subheadline">Your weekly recap is ready</span>
                <ChevronRight size={18} className="text-label-secondary" aria-hidden />
              </Link>
            </section>

            {/* --- Today's habits --- */}
            <section>
              <h2 className="mb-3 text-title2 font-bold">Today&rsquo;s Habits</h2>

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

      <AddHabitSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={async (draft) => {
          await addHabit(draft);
        }}
      />

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
