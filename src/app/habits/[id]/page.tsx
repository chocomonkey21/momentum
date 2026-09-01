'use client';

import { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Pencil, NotebookPen } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Screen, PushedHeader, PageFade } from '@/components/ui/Screen';
import { Button, IconButton } from '@/components/ui/Button';
import { MomentumRing } from '@/components/ui/MomentumRing';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { ConfirmDialog, Sheet } from '@/components/ui/Sheet';
import { MoodCalendar, StreakDotRow } from '@/components/chart/MoodCalendar';
import { InsightCard, AdaptiveDifficultyBanner } from '@/components/habit/InsightCard';
import { AddHabitSheet } from '@/components/habit/AddHabitSheet';
import { LogHabitSheet } from '@/components/habit/LogHabitSheet';
import { habitInsight, MIN_LOGS_FOR_INSIGHT } from '@/lib/insights';
import { adaptiveDifficultySuggestion } from '@/lib/momentum';
import { MOOD_LABELS, MOOD_COLORS } from '@/theme/theme';
import { formatHHmm } from '@/lib/dates';
import { format } from 'date-fns';
import type { MoodTag } from '@/db/schema';

const DIFFICULTY_NAMES: Record<1 | 2 | 3, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
const CONTEXT_NAMES: Record<string, string> = {
  home: 'Home',
  work: 'Work',
  gym: 'Gym',
  other: 'Other',
};

/**
 * Habit Detail (ui-spec.md §6) — momentum ring (hero), streak, mood calendar,
 * insight, conditional adaptive-difficulty banner, and a low-prominence delete.
 */
export default function HabitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const habitId = Number(id);
  const router = useRouter();
  const { status, errorMessage, retry, habits, editHabit, removeHabit, chainNamesForHabit, saveLog } =
    useApp();

  const [editOpen, setEditOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false);

  const habit = habits.find((h) => h.id === habitId);

  const insight = useMemo(
    () => (habit ? habitInsight(habit.name, habit.logs) : null),
    [habit],
  );

  const suggestion = habit
    ? adaptiveDifficultySuggestion(habit.difficultyLevel, habit.missStreak)
    : null;

  const selectedLog = habit && selectedDay ? habit.logs.find((l) => l.date === selectedDay) : undefined;

  if (status === 'error') {
    return (
      <Screen>
        <PushedHeader title="Habit" fallbackHref="/habits" />
        <ErrorState message={errorMessage ?? 'Something went wrong.'} onRetry={retry} />
      </Screen>
    );
  }

  if (status === 'loading') {
    return (
      <Screen>
        <PushedHeader title="Loading…" fallbackHref="/habits" />
        <div className="flex flex-col items-center gap-6">
          {/* Ring track is visible immediately; only the fill waits for data. */}
          <MomentumRing value={0} loading label="Momentum" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Screen>
    );
  }

  if (!habit) {
    return (
      <Screen>
        <PushedHeader title="Habit not found" fallbackHref="/habits" />
        <ErrorState
          message="We couldn't find that habit — it may have been removed from your active list."
          onRetry={() => router.push('/habits')}
        />
      </Screen>
    );
  }

  const chainNames = chainNamesForHabit(habit.id);
  const loggedDays = habit.logs.length;

  return (
    <Screen>
      <PageFade>
        <PushedHeader
          title={habit.name}
          fallbackHref="/habits"
          action={
            <IconButton label={`Edit ${habit.name}`} onClick={() => setEditOpen(true)}>
              <Pencil size={20} aria-hidden />
            </IconButton>
          }
        />

        {/* --- Hero: the momentum ring gets the most visual weight (CLAUDE.md §3) --- */}
        <section className="mb-8 flex flex-col items-center gap-4">
          <MomentumRing value={habit.momentumScore} label="Momentum" size={200} />
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <span className="inline-flex items-center gap-1.5 text-subheadline">
              <Flame size={16} className="text-warning" aria-hidden />
              {habit.streak} day streak
            </span>
            <span className="text-subheadline text-label-secondary">
              {DIFFICULTY_NAMES[habit.difficultyLevel]}
            </span>
            <span className="text-subheadline text-label-secondary capitalize">
              {habit.frequency}
            </span>
            {habit.timeConstraint && (
              <span className="text-subheadline text-label-secondary">
                by {formatHHmm(habit.timeConstraint)}
              </span>
            )}
          </div>

          <Button onClick={() => setLogOpen(true)} className="mt-2">
            <NotebookPen size={18} aria-hidden />
            Log today
          </Button>
        </section>

        {suggestion !== null && !dismissedSuggestion && (
          <section className="mb-6">
            <AdaptiveDifficultyBanner
              habitName={habit.name}
              currentLevel={habit.difficultyLevel}
              suggestedLevel={suggestion}
              onDismiss={() => setDismissedSuggestion(true)}
              onAccept={async () => {
                await editHabit(habit.id, {
                  name: habit.name,
                  frequency: habit.frequency,
                  difficultyLevel: suggestion,
                  timeConstraint: habit.timeConstraint,
                  categoryTag: habit.categoryTag,
                });
                setDismissedSuggestion(true);
              }}
            />
          </section>
        )}

        <section className="mb-8">
          <h2 className="mb-3 text-title2 font-bold">Last 21 days</h2>
          <div className="rounded-[var(--radius-card)] bg-bg-secondary p-5">
            <StreakDotRow logs={habit.logs} />
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-title2 font-bold">History</h2>
          <div className="rounded-[var(--radius-card)] bg-bg-secondary p-5">
            <MoodCalendar
              logs={habit.logs}
              selectedDay={selectedDay}
              onSelectDay={(d) => setSelectedDay(d)}
            />
          </div>
        </section>

        <section className="mb-8">
          {insight && loggedDays >= MIN_LOGS_FOR_INSIGHT ? (
            <InsightCard text={insight} />
          ) : (
            <InsightCard
              hint
              text="Complete this habit to start building momentum — patterns show up after about three logged days."
            />
          )}
        </section>

        {/* Destructive, deliberately lowest visual weight on the screen. */}
        <section className="border-t border-separator pt-6">
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            Delete Habit
          </Button>
        </section>
      </PageFade>

      {/* Day detail — read-only popover per ui-spec.md §6. */}
      <Sheet
        open={selectedDay !== null}
        onOpenChange={(o) => !o && setSelectedDay(null)}
        title={selectedDay ? format(new Date(selectedDay + 'T00:00:00'), 'EEEE, MMMM d') : ''}
        description={habit.name}
      >
        {selectedLog ? (
          <dl className="flex flex-col gap-4">
            <div>
              <dt className="text-caption1 uppercase tracking-wide text-label-secondary">Status</dt>
              <dd className="mt-1 text-body">
                {selectedLog.completed === 1 ? 'Completed' : 'Missed'}
              </dd>
            </div>
            <div>
              <dt className="text-caption1 uppercase tracking-wide text-label-secondary">Mood</dt>
              <dd className="mt-1 flex items-center gap-2 text-body">
                {selectedLog.moodTag ? (
                  <>
                    <span
                      aria-hidden
                      className="size-3 rounded-full"
                      style={{ backgroundColor: MOOD_COLORS[selectedLog.moodTag as MoodTag] }}
                    />
                    {MOOD_LABELS[selectedLog.moodTag as MoodTag]}
                  </>
                ) : (
                  <span className="text-label-secondary">Not recorded</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-caption1 uppercase tracking-wide text-label-secondary">Context</dt>
              <dd className="mt-1 text-body">
                {selectedLog.contextTag ? (
                  CONTEXT_NAMES[selectedLog.contextTag]
                ) : (
                  <span className="text-label-secondary">Not recorded</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-caption1 uppercase tracking-wide text-label-secondary">Notes</dt>
              <dd className="mt-1 text-body">
                {selectedLog.notes ?? <span className="text-label-secondary">No notes</span>}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-body text-label-secondary">Nothing was logged on this day.</p>
        )}
      </Sheet>

      <AddHabitSheet
        mode="edit"
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={{
          name: habit.name,
          frequency: habit.frequency,
          difficultyLevel: habit.difficultyLevel,
          timeConstraint: habit.timeConstraint,
          categoryTag: habit.categoryTag,
        }}
        onSubmit={(draft) => editHabit(habit.id, draft)}
      />

      <LogHabitSheet
        habit={habit}
        open={logOpen}
        onOpenChange={setLogOpen}
        onSave={saveLog}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${habit.name}?`}
        body={
          chainNames.length > 0
            ? `Your history will be kept, but it will be removed from your active list. This habit is part of ${chainNames.join(
                ' and ',
              )} — deleting it will remove it from ${chainNames.length > 1 ? 'those chains' : 'that chain'}.`
            : 'Your history will be kept, but it will be removed from your active list.'
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          setConfirmDelete(false);
          await removeHabit(habit.id);
          router.push('/habits');
        }}
      />
    </Screen>
  );
}
