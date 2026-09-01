'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Sparkles } from 'lucide-react';
import { useApp, type HabitView } from '@/context/AppContext';
import { Screen, ScreenHeader, PageFade } from '@/components/ui/Screen';
import { IconButton } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState, ErrorState, SkeletonCardList } from '@/components/ui/States';
import { HabitCard } from '@/components/habit/HabitCard';
import { AddHabitSheet } from '@/components/habit/AddHabitSheet';
import { ChainsPanel } from '@/components/habit/ChainsPanel';
import { ConfirmDialog } from '@/components/ui/Sheet';
import { completionRate } from '@/lib/streak';
import { dayKeyRange, toDayKey } from '@/lib/dates';

type View = 'habits' | 'chains';
type Range = 'today' | 'week' | 'year';

const VIEWS: { value: View; label: string }[] = [
  { value: 'habits', label: 'Habits' },
  { value: 'chains', label: 'Chains' },
];

const RANGES: { value: Range; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'year', label: 'Year' },
];

/**
 * Habits (ui-spec.md §5) with Chains (§9) merged in as a second view rather
 * than a separate nav destination.
 *
 * Chains are a grouping OF habits, so they belong in the habits section — and
 * folding them in frees the tab-bar slot that Friends now occupies. Both views
 * keep their full behaviour; only the hosting changed. `/chains` still resolves
 * (it redirects here with this view preselected) so older links don't dead-end.
 */
export default function HabitsPage() {
  return (
    // useSearchParams needs a Suspense boundary in the App Router.
    <Suspense fallback={<Screen><SkeletonCardList rows={4} /></Screen>}>
      <HabitsScreen />
    </Suspense>
  );
}

function HabitsScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, errorMessage, retry, habits, setCompletion, addHabit, removeHabit } = useApp();

  const [view, setView] = useState<View>(
    searchParams.get('view') === 'chains' ? 'chains' : 'habits',
  );
  const [range, setRange] = useState<Range>('today');
  const [addOpen, setAddOpen] = useState(false);
  const [newChainSignal, setNewChainSignal] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<HabitView | null>(null);

  const windowKeys = useMemo(() => {
    if (range === 'today') return null;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (range === 'week' ? 6 : 364));
    return new Set(dayKeyRange(toDayKey(start), toDayKey(end)));
  }, [range]);

  function statFor(habit: HabitView): { label: string; value: string } | undefined {
    if (range === 'today' || !windowKeys) return undefined;
    const inWindow = habit.logs.filter((l) => windowKeys.has(l.date));
    return {
      label: range === 'week' ? 'This week' : 'This year',
      value: `${completionRate(inWindow)}%`,
    };
  }

  return (
    <Screen>
      <PageFade>
        <ScreenHeader
          title={view === 'habits' ? 'Your Habits' : 'Habit Chains'}
          action={
            <IconButton
              label={view === 'habits' ? 'Add a habit' : 'Create a new chain'}
              onClick={() =>
                view === 'habits' ? setAddOpen(true) : setNewChainSignal((n) => n + 1)
              }
            >
              <Plus size={24} aria-hidden />
            </IconButton>
          }
        />

        <div className="mb-5">
          <SegmentedControl
            options={VIEWS}
            value={view}
            onChange={setView}
            ariaLabel="Habits or chains"
          />
        </div>

        {status === 'error' ? (
          <ErrorState message={errorMessage ?? 'Something went wrong.'} onRetry={retry} />
        ) : view === 'chains' ? (
          <ChainsPanel
            openBuilderSignal={newChainSignal}
            onBuilderHandled={() => setNewChainSignal((n) => n)}
          />
        ) : (
          <>
            <div className="mb-5">
              <SegmentedControl
                options={RANGES}
                value={range}
                onChange={setRange}
                ariaLabel="Stat time range"
              />
            </div>

            {status === 'loading' ? (
              <SkeletonCardList rows={4} />
            ) : habits.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                message="No habits yet. Momentum starts with one — it doesn't have to be a big one."
                actionLabel="Add your first habit"
                onAction={() => setAddOpen(true)}
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {habits.map((habit) => {
                  const stat = statFor(habit);
                  return (
                    <li key={habit.id}>
                      <HabitCard
                        habit={habit}
                        onToggle={setCompletion}
                        onOpen={(id) => router.push(`/habits/${id}`)}
                        onDelete={() => setPendingDelete(habit)}
                        statLabel={stat?.label}
                        statValue={stat?.value}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </>
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
