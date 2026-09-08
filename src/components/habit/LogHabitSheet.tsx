'use client';

import { useEffect, useState } from 'react';
import { Clock, Check, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { spring, reducedFade, MOOD_COLORS, MOOD_LABELS, semantic, palette } from '@/theme/theme';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { formatHHmm, todayKey } from '@/lib/dates';
import { format } from 'date-fns';
import { isPastWindow } from '@/lib/timeConstraint';
import type { ContextTag, MoodTag } from '@/db/schema';
import type { HabitView } from '@/context/AppContext';

const CONTEXTS: { value: ContextTag; label: string }[] = [
  { value: 'home', label: 'Home' },
  { value: 'work', label: 'Work' },
  { value: 'gym', label: 'Gym' },
  { value: 'other', label: 'Other' },
];

const NOTES_MAX = 280; // data-model.md §3

export interface LogDraft {
  completed: boolean;
  moodTag: MoodTag | null;
  contextTag: ContextTag | null;
  notes: string | null;
  /** An intentional, user-chosen skip — doesn't break a streak, excluded
   *  from the consistency rate. Distinct from an ordinary miss. */
  skipped?: boolean;
}

/**
 * Log Habit (ui-spec.md §8) — the detailed entry path, as opposed to Home's
 * quick toggle. Nothing is written until Save.
 *
 * Time windows no longer block anything here: a completion after the window
 * closes is still allowed, just flagged late — the habit still counts
 * toward the streak (lib/timeConstraint.ts v2). "Skipped" is the
 * intentional-skip path: unlike simply not logging (which the nightly
 * backfill later records as an ordinary miss), choosing Skipped here writes
 * a log that doesn't break a streak and is excluded from the consistency
 * rate.
 *
 * Passing a `date` other than today puts this in backfill mode
 * (data-model.md's 7-day backfill window) — the window/lateness messaging
 * doesn't apply to a day being logged after the fact.
 */
export function LogHabitSheet({
  habit,
  open,
  onOpenChange,
  onSave,
  date,
}: {
  habit: HabitView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    habitId: number,
    draft: LogDraft,
    date?: string,
  ) => Promise<{ onTime: boolean | null; completionTime: string } | void>;
  /** Defaults to today; anything else is a backfilled past entry. */
  date?: string;
}) {
  const reduce = useReducedMotion();
  const [completed, setCompleted] = useState(true);
  const [mood, setMood] = useState<MoodTag | null>(null);
  const [context, setContext] = useState<ContextTag | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const targetDate = date ?? todayKey();
  const isBackfill = targetDate !== todayKey();
  const late = !isBackfill && habit ? isPastWindow(habit.timeConstraint) : false;

  useEffect(() => {
    if (!open || !habit) return;
    const existing = habit.todayLog;
    setCompleted(isBackfill ? true : (existing?.completed !== 0));
    setMood((existing?.moodTag as MoodTag | null) ?? null);
    setContext(existing?.contextTag ?? null);
    setNotes(existing?.notes ?? '');
    setSaving(false);
  }, [open, habit, isBackfill]);

  if (!habit) return null;

  async function save() {
    if (!habit) return;
    setSaving(true);
    try {
      await onSave(
        habit.id,
        {
          completed,
          skipped: !completed,
          moodTag: mood,
          contextTag: context,
          notes: notes.trim() ? notes.trim().slice(0, NOTES_MAX) : null,
        },
        targetDate,
      );
      onOpenChange(false);
    } catch {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={habit.name}
      description={isBackfill ? `Logging for ${format(new Date(targetDate + 'T00:00:00'), 'MMMM d')}` : 'Log Today'}
    >
      <div className="flex flex-col gap-6">
        {/* Completed / Skipped — the primary decision, two large buttons. */}
        <div className="grid grid-cols-2 gap-3">
          <BigToggle
            selected={completed}
            onSelect={() => setCompleted(true)}
            icon={<Check size={20} aria-hidden />}
            label="Completed"
            tone="positive"
          />
          <BigToggle
            selected={!completed}
            onSelect={() => setCompleted(false)}
            icon={<X size={20} aria-hidden />}
            label="Skipped"
            tone="neutral"
          />
        </div>

        {late && completed && (
          <p
            role="status"
            className={cn(
              'flex items-start gap-2 rounded-[var(--radius-block)] p-3',
              'text-footnote',
            )}
            style={{ backgroundColor: 'rgba(255,122,0,0.12)', color: semantic.warning }}
          >
            <Clock size={14} className="mt-1 shrink-0" aria-hidden />
            <span>
              This will be logged as <b>late</b> — its window closed at{' '}
              {habit.timeConstraint ? formatHHmm(habit.timeConstraint) : 'earlier today'}. It still
              counts toward your streak.
            </span>
          </p>
        )}

        {isBackfill && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-[var(--radius-block)] bg-bg-secondary p-3 text-footnote text-label-secondary"
          >
            <Clock size={14} className="mt-1 shrink-0" aria-hidden />
            <span>Backfilling a past day — momentum recalculates from the full history either way.</span>
          </p>
        )}

        {!completed && (
          <p className="text-footnote text-label-secondary">
            Marking this a skip won&rsquo;t break your streak, but it also won&rsquo;t count toward
            your consistency rate — use it for a day you deliberately took off, not one you forgot.
          </p>
        )}

        {/* Mood — 5-point scale (data-model.md §3). Still available on a skip:
            "skipped, felt tired, at home" is a meaningful data point. */}
        <fieldset>
          <legend className="font-data mb-3 text-label-tertiary">How did it feel?</legend>
          <div className="flex flex-wrap gap-2">
            {([1, 2, 3, 4, 5] as MoodTag[]).map((m) => {
              const selected = mood === m;
              return (
                <motion.button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={MOOD_LABELS[m]}
                  onClick={() => setMood(selected ? null : m)}
                  whileTap={reduce ? { opacity: 0.7 } : { scale: 0.94 }}
                  transition={reduce ? reducedFade : spring.default}
                  className={cn(
                    'flex min-h-[72px] flex-1 flex-col items-center justify-center gap-2',
                    'rounded-[var(--radius-block)] px-1 py-3 transition-colors',
                    mood !== null && !selected && 'opacity-50',
                  )}
                  // The selected mood fills its whole cell with its colour.
                  style={{ backgroundColor: selected ? MOOD_COLORS[m] : semantic.bgTertiary }}
                >
                  <span
                    aria-hidden
                    className="size-6 rounded-[8px]"
                    style={{
                      backgroundColor: selected ? 'rgba(0,0,0,0.25)' : MOOD_COLORS[m],
                    }}
                  />
                  <span
                    className="font-data"
                    style={{ color: selected ? palette.ink0 : semantic.labelSecondary }}
                  >
                    {MOOD_LABELS[m]}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-data mb-3 text-label-tertiary">Where were you?</legend>
          <div className="flex flex-wrap gap-2">
            {CONTEXTS.map((c) => (
              <Chip
                key={c.value}
                selected={context === c.value}
                dimmed={context !== null}
                onSelect={() => setContext(context === c.value ? null : c.value)}
              >
                {c.label}
              </Chip>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="log-notes" className="font-data mb-2 block text-label-tertiary">
            Notes (optional)
          </label>
          <textarea
            id="log-notes"
            value={notes}
            rows={3}
            maxLength={NOTES_MAX}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything worth remembering about today?"
            className={cn(
              'w-full resize-none rounded-[var(--radius-block)] bg-bg-tertiary px-4 py-4',
              'text-body text-label-primary placeholder:text-label-tertiary',
              'border border-transparent transition-colors focus:border-tint',
            )}
          />
          <p className="mt-1 text-right text-caption1 text-label-secondary">
            {notes.length}/{NOTES_MAX}
          </p>
        </div>

        <Button onClick={save} loading={saving} fullWidth>
          Save Entry
        </Button>
      </div>
    </Sheet>
  );
}

function BigToggle({
  selected,
  onSelect,
  icon,
  label,
  tone,
  disabled = false,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  tone: 'positive' | 'neutral';
  disabled?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      // Fills immediately on press-down — the user shouldn't wait to see their
      // choice register (interaction-spec.md §3).
      onPointerDown={(e) => {
        if (disabled) return;
        e.preventDefault();
        onSelect();
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      whileTap={disabled || reduce ? undefined : { scale: 0.97 }}
      transition={reduce ? reducedFade : spring.default}
      className={cn(
        'flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-[var(--radius-card)]',
        'font-display text-[17px] uppercase tracking-[0.04em] transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        selected && tone === 'positive' && 'bg-positive text-black',
        selected && tone === 'neutral' && 'bg-white text-black',
        !selected && 'bg-bg-tertiary text-label-secondary hover:text-label-primary',
      )}
    >
      {icon}
      {label}
    </motion.button>
  );
}
