'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Link2, Check } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Screen, ScreenHeader, PageFade } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Sheet } from '@/components/ui/Sheet';
import { MomentumRing } from '@/components/ui/MomentumRing';
import { savePomodoroSession, getPomodoroSessions } from '@/db/queries';
import type { PomodoroSession } from '@/db/schema';
import { semantic, chartHex, palette } from '@/theme/theme';
import { cn } from '@/lib/cn';

const PRESETS = [25, 45, 60];

/**
 * Focus / Pomodoro (ui-spec.md §10).
 *
 * The linked habit is correlation only: per data-model.md §7 a completed
 * session does NOT create or update a HabitLog. The user still logs the habit
 * through the normal Log Habit flow — the link exists so the app can say
 * "3 focus sessions against Read this week", not to silently complete a habit.
 */
export default function FocusPage() {
  const { habits, userId, showToast } = useApp();

  const [durationMinutes, setDuration] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [linkedHabitId, setLinkedHabitId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const reloadSessions = useCallback(async () => {
    if (!userId) return;
    setSessions(await getPomodoroSessions(userId));
  }, [userId]);
  useEffect(() => {
    void reloadSessions();
  }, [reloadSessions]);

  const linkedHabit = habits.find((h) => h.id === linkedHabitId) ?? null;
  const total = durationMinutes * 60;
  // Ring depletes as time elapses; this one is genuinely linear real-time
  // tracking, not a spring (interaction-spec.md §10).
  const pct = total === 0 ? 0 : (remaining / total) * 100;

  const finish = useCallback(
    async (completed: 0 | 1) => {
      setRunning(false);
      if (userId && startedAt) {
        await savePomodoroSession({
          userId,
          habitId: linkedHabitId,
          startTime: startedAt,
          durationMinutes,
          // Abandoned sessions are still recorded, flagged incomplete
          // (user-flows.md §14).
          completed,
        });
      }
      await reloadSessions();
      setStartedAt(null);
      setRemaining(durationMinutes * 60);
      if (completed === 1) {
        setJustCompleted(true);
        showToast('Focus session complete');
        setTimeout(() => setJustCompleted(false), 2500);
      }
    },
    [userId, startedAt, linkedHabitId, durationMinutes, showToast, reloadSessions],
  );

  // Tick. Uses a wall-clock deadline rather than accumulating setInterval drift.
  const deadlineRef = useRef<number | null>(null);
  useEffect(() => {
    if (!running) return;
    if (deadlineRef.current === null) deadlineRef.current = Date.now() + remaining * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round(((deadlineRef.current ?? 0) - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        deadlineRef.current = null;
        void finish(1);
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, remaining, finish]);

  function start() {
    if (!startedAt) setStartedAt(new Date().toISOString());
    deadlineRef.current = Date.now() + remaining * 1000;
    setRunning(true);
  }

  function pause() {
    deadlineRef.current = null;
    setRunning(false);
  }

  function reset() {
    deadlineRef.current = null;
    if (startedAt) void finish(0);
    else {
      setRunning(false);
      setRemaining(durationMinutes * 60);
    }
  }

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const idle = !running && !startedAt;

  const todaySessions = (sessions ?? []).filter(
    (s) => s.startTime.slice(0, 10) === new Date().toISOString().slice(0, 10),
  );

  return (
    <Screen>
      <PageFade>
        <ScreenHeader title="Focus" eyebrow="Pomodoro" />

        <section className="flex flex-col gap-4">
          {/* The timer block: tint blue while running, green the moment it
              completes, neutral while idle. The digits are the hero number. */}
          <div
            className="flex flex-col items-center rounded-[var(--radius-card)] p-6 transition-colors duration-300"
            style={{
              backgroundColor: justCompleted
                ? semantic.positive
                : running
                  ? semantic.tint
                  : semantic.bgSecondary,
              color: justCompleted ? palette.ink0 : palette.white,
            }}
          >
            <div className="relative">
              <MomentumRing
                value={pct}
                size={232}
                strokeWidth={18}
                hero={false}
                celebrate={false}
                showValue={false}
                fillColor={justCompleted ? palette.ink0 : running ? palette.white : semantic.tint}
                trackColor={running || justCompleted ? 'rgba(0,0,0,0.18)' : palette.ink4}
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display-hero text-[64px] leading-none">
                  {mins}:{String(secs).padStart(2, '0')}
                </span>
                {linkedHabit && (
                  <span className={cn('font-data mt-2 max-w-[152px] truncate', justCompleted && 'opacity-70')}>
                    {linkedHabit.name}
                  </span>
                )}
              </div>
            </div>

            <div
              role="status"
              aria-live="polite"
              className={cn('font-data mt-4 min-h-[16px]', justCompleted && 'opacity-70')}
            >
              {/* Announce at minute boundaries and completion, not every tick
                  (ui-spec.md §10 assumption). */}
              {justCompleted
                ? 'Session complete'
                : running
                  ? `${mins} minute${mins === 1 ? '' : 's'} remaining`
                  : startedAt
                    ? 'Paused'
                    : 'Ready when you are'}
            </div>

            <div className="mt-6 flex w-full items-center gap-3">
              <Button
                onClick={running ? pause : start}
                className="flex-1"
                style={{
                  backgroundColor: justCompleted ? palette.ink0 : palette.white,
                  color: justCompleted ? palette.white : palette.ink0,
                }}
              >
                {running ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
                {running ? 'Pause' : startedAt ? 'Resume' : 'Start'}
              </Button>
              <Button
                variant="secondary"
                onClick={reset}
                disabled={idle}
                aria-label="Reset session"
                className="px-5"
                style={
                  running || justCompleted
                    ? { backgroundColor: 'rgba(0,0,0,0.2)', color: 'inherit' }
                    : undefined
                }
              >
                <RotateCcw size={18} aria-hidden />
              </Button>
            </div>
          </div>

          <fieldset className="w-full rounded-[var(--radius-card)] bg-bg-secondary p-5">
            <legend className="sr-only">Duration</legend>
            <p className="font-data mb-3 text-label-tertiary" aria-hidden>
              Duration
            </p>
            <div className="flex gap-2">
              {PRESETS.map((p) => (
                <Chip
                  key={p}
                  selected={durationMinutes === p}
                  // Presets are disabled while a session is running — Reset
                  // first to change duration (ui-spec.md §10).
                  disabled={!idle}
                  onSelect={() => {
                    setDuration(p);
                    setRemaining(p * 60);
                  }}
                  className="flex-1"
                >
                  {p} min
                </Chip>
              ))}
            </div>
          </fieldset>

          {/* Optional habit link — lowest emphasis, and settable only before
              Start, since changing it mid-session confuses what it counted for. */}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={!idle}
            className={cn(
              'flex w-full min-h-[56px] items-center gap-3 rounded-[var(--radius-card)]',
              'bg-bg-secondary px-5 py-4 text-left transition-colors hover:bg-bg-tertiary',
              'disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            <Link2 size={18} className="text-label-secondary" aria-hidden />
            <span className="flex-1 text-subheadline">
              {linkedHabit ? `Linked to ${linkedHabit.name}` : 'Link to a habit (optional)'}
            </span>
            {linkedHabit && (
              <span
                aria-hidden
                className="size-6 rounded-[8px]"
                style={{ backgroundColor: chartHex(linkedHabit.chartColor) }}
              />
            )}
          </button>

          {linkedHabit && (
            <p className="text-footnote leading-relaxed text-label-secondary">
              Linking records the session against {linkedHabit.name}. It doesn&rsquo;t mark the
              habit complete — log that separately.
            </p>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-display mb-3 text-title2">Today&rsquo;s sessions</h2>
          {todaySessions.length === 0 ? (
            <p className="rounded-[var(--radius-card)] bg-bg-secondary px-5 py-6 text-body text-label-secondary">
              No focus sessions yet today.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {todaySessions.map((s) => {
                const habit = habits.find((h) => h.id === s.habitId);
                return (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 rounded-[var(--radius-block)] bg-bg-secondary px-4 py-4"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'inline-flex size-7 items-center justify-center rounded-[8px]',
                        s.completed === 1 ? 'bg-positive' : 'bg-bg-tertiary',
                      )}
                    >
                      {s.completed === 1 && <Check size={14} className="text-black" />}
                    </span>
                    <span className="flex-1 text-subheadline">
                      {s.durationMinutes} min{habit ? ` · ${habit.name}` : ''}
                    </span>
                    <span className="font-data text-label-tertiary">
                      {s.completed === 1 ? 'Completed' : 'Abandoned'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </PageFade>

      <Sheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Link to a habit"
        description="Records this session against a habit. It won't mark it complete."
      >
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setLinkedHabitId(null);
              setPickerOpen(false);
            }}
            className="min-h-[56px] rounded-[var(--radius-block)] bg-bg-tertiary px-4 py-3 text-left text-body font-medium hover:bg-ink5"
          >
            No habit — general focus time
          </button>
          {habits.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => {
                setLinkedHabitId(h.id);
                setPickerOpen(false);
              }}
              className="flex min-h-[56px] items-center gap-3 rounded-[var(--radius-block)] bg-bg-tertiary px-4 py-3 text-left text-body font-medium hover:bg-ink5"
            >
              <span
                aria-hidden
                className="size-8 rounded-[10px]"
                style={{ backgroundColor: chartHex(h.chartColor) }}
              />
              {h.name}
            </button>
          ))}
        </div>
      </Sheet>
    </Screen>
  );
}
