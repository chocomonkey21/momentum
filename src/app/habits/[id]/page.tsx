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
import { MoodCalendar, StreakDotRow, MoodStatsFooter } from '@/components/chart/MoodCalendar';
import { InsightCard, AdaptiveDifficultyBanner } from '@/components/habit/InsightCard';
import { AddHabitSheet } from '@/components/habit/AddHabitSheet';
import { LogHabitSheet } from '@/components/habit/LogHabitSheet';
import { habitInsight, MIN_LOGS_FOR_INSIGHT } from '@/lib/insights';
import { adaptiveDifficultySuggestion } from '@/lib/momentum';
import { MOOD_LABELS, MOOD_COLORS, chartHex, onChartHex, palette } from '@/theme/theme';
import { formatHHmm } from '@/lib/dates';
import { format } from 'date-fns';
import { cn } from '@/lib/cn';
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
  const heroBg = chartHex(habit.chartColor);
  const heroFg = onChartHex(habit.chartColor);
  // Black can be dimmed on the light hues and still clear AA; white on blue can't.
  const muted = heroFg === palette.ink0 ? 'opacity-70' : '';

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

        {/* --- Hero: one solid block of the habit's own hue. The ring is the
            hero (CLAUDE.md §3); everything else on the block is subordinate. --- */}
        <section
          className="mb-6 rounded-[var(--radius-card)] p-6"
          style={{ backgroundColor: heroBg, color: heroFg }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {habit.categoryTag && <p className={cn('font-data', muted)}>{habit.categoryTag}</p>}
              {/* Streak: stat pattern. */}
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display-hero text-[56px] leading-none">{habit.streak}</span>
                <Flame size={20} aria-hidden className={muted} />
              </div>
              <p className={cn('font-data mt-2', muted)}>
                day{habit.streak === 1 ? '' : 's'} running
              </p>
            </div>
            <MomentumRing
              value={habit.momentumScore}
              label="Momentum"
              size={148}
              strokeWidth={14}
              fillColor={heroFg}
              trackColor="rgba(0,0,0,0.18)"
              className="shrink-0"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {[
              DIFFICULTY_NAMES[habit.difficultyLevel],
              habit.frequency,
              habit.timeConstraint ? `by ${formatHHmm(habit.timeConstraint)}` : null,
            ]
              .filter(Boolean)
              .map((chip) => (
                <span
                  key={chip as string}
                  className="font-data rounded-[var(--radius-pill)] px-3 py-2 capitalize"
                  style={{ backgroundColor: 'rgba(0,0,0,0.18)' }}
                >
                  {chip}
                </span>
              ))}
          </div>

          <Button
            onClick={() => setLogOpen(true)}
            fullWidth
            className="mt-6"
            style={{ backgroundColor: heroFg, color: heroBg }}
          >
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
          <h2 className="font-display mb-3 text-title2">Last 21 Days</h2>
          <div className="rounded-[var(--radius-card)] bg-bg-secondary p-5">
            <StreakDotRow logs={habit.logs} />
          </div>
        </section>

        <section className="mb-8">
          <h2 className="font-display mb-3 text-title2">History</h2>
          <div className="rounded-[var(--radius-card)] bg-bg-secondary p-5">
            <MoodCalendar
              logs={habit.logs}
              selectedDay={selectedDay}
              onSelectDay={(d) => setSelectedDay(d)}
            />
            <MoodStatsFooter logs={habit.logs} />
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
        <section className="border-t border-white/[0.07] pt-6">
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
          <dl className="flex flex-col gap-5">
            <div>
              <dt className="font-data text-label-tertiary">Status</dt>
              <dd className="mt-2">
                <span
                  className="font-display inline-flex min-h-[36px] items-center rounded-[var(--radius-pill)] px-4 text-[15px] uppercase tracking-[0.04em]"
                  style={
                    selectedLog.completed === 1
                      ? { backgroundColor: heroBg, color: heroFg }
                      : { backgroundColor: palette.ink4, color: palette.white }
                  }
                >
                  {selectedLog.completed === 1 ? 'Completed' : 'Missed'}
                </span>
              </dd>
            </div>
            <div>
              <dt className="font-data text-label-tertiary">Mood</dt>
              <dd className="mt-2 flex items-center gap-3 text-body">
                {selectedLog.moodTag ? (
                  <>
                    <span
                      aria-hidden
                      className="size-6 rounded-[8px]"
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
              <dt className="font-data text-label-tertiary">Context</dt>
              <dd className="mt-2 text-body">
                {selectedLog.contextTag ? (
                  CONTEXT_NAMES[selectedLog.contextTag]
                ) : (
                  <span className="text-label-secondary">Not recorded</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="font-data text-label-tertiary">Notes</dt>
              <dd className="mt-2 text-body leading-relaxed">
                {selectedLog.notes ?? <span className="text-label-secondary">No notes</span>}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-body leading-relaxed text-label-secondary">Nothing was logged on this day.</p>
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
