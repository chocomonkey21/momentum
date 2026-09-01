'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Sparkles } from 'lucide-react';
import { useApp, type HabitView } from '@/context/AppContext';
import { Screen, ScreenHeader, PageFade } from '@/components/ui/Screen';
import { IconButton } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState, ErrorState, SkeletonCardList } from '@/components/ui/States';
import { HabitCard } from '@/components/habit/HabitCard';
import { AddHabitSheet } from '@/components/habit/AddHabitSheet';
import { ConfirmDialog } from '@/components/ui/Sheet';
import { completionRate } from '@/lib/streak';
import { todayKey, dayKeyRange, toDayKey } from '@/lib/dates';

type Range = 'today' | 'week' | 'year';

const RANGES: { value: Range; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'year', label: 'Year' },
];

/**
 * Habits List (ui-spec.md §5) — the full roster, not filtered to today.
 *
 * The segmented control changes the STAT shown on each card, not which habits
 * are listed (§5). Bottom padding to clear the tab bar comes from <Screen>.
 */
export default function HabitsPage() {
  const router = useRouter();
  const { status, errorMessage, retry, habits, setCompletion, addHabit, removeHabit } = useApp();

  const [range, setRange] = useState<Range>('today');
  const [addOpen, setAddOpen] = useState(false);
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
          title="Your Habits"
          action={
            <IconButton label="Add a habit" onClick={() => setAddOpen(true)}>
              <Plus size={24} aria-hidden />
            </IconButton>
          }
        />

        <div className="mb-5">
          <SegmentedControl
            options={RANGES}
            value={range}
            onChange={setRange}
            ariaLabel="Stat time range"
          />
        </div>

        {status === 'error' ? (
          <ErrorState message={errorMessage ?? 'Something went wrong.'} onRetry={retry} />
        ) : status === 'loading' ? (
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
