'use client';

import { useEffect, useState } from 'react';
import { Lock, Check, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { spring, reducedFade, MOOD_COLORS, MOOD_LABELS } from '@/theme/theme';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { formatHHmm } from '@/lib/dates';
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
}

/**
 * Log Habit (ui-spec.md §8) — the detailed entry path, as opposed to Home's
 * quick toggle. Nothing is written until Save.
 *
 * The important state here is the time-constraint LOCKOUT: when canLogToday()
 * is false, the Completed path is disabled with explanatory copy — not just a
 * dimmed button, since the reason isn't otherwise obvious. Skipped stays
 * available, with mood and context, because a skip is still useful data.
 */
export function LogHabitSheet({
  habit,
  open,
  onOpenChange,
  onSave,
}: {
  habit: HabitView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (habitId: number, draft: LogDraft) => Promise<void>;
}) {
  const reduce = useReducedMotion();
  const [completed, setCompleted] = useState(true);
  const [mood, setMood] = useState<MoodTag | null>(null);
  const [context, setContext] = useState<ContextTag | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const locked = habit?.locked ?? false;

  useEffect(() => {
    if (!open || !habit) return;
    const existing = habit.todayLog;
    // Locked habits cannot start on the Completed path (§8 disabled state).
    setCompleted(locked ? false : existing?.completed !== 0);
    setMood((existing?.moodTag as MoodTag | null) ?? null);
    setContext(existing?.contextTag ?? null);
    setNotes(existing?.notes ?? '');
    setSaving(false);
  }, [open, habit, locked]);

  if (!habit) return null;

  async function save() {
    if (!habit) return;
    setSaving(true);
    try {
      await onSave(habit.id, {
        completed,
        moodTag: mood,
        contextTag: context,
        notes: notes.trim() ? notes.trim().slice(0, NOTES_MAX) : null,
      });
      onOpenChange(false);
    } catch {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={habit.name} description="Log today">
      <div className="flex flex-col gap-6">
        {/* Completed / Skipped — the primary decision, two large buttons. */}
        <div className="grid grid-cols-2 gap-3">
          <BigToggle
            selected={completed}
            disabled={locked}
            onSelect={() => setCompleted(true)}
            icon={locked ? <Lock size={20} aria-hidden /> : <Check size={20} aria-hidden />}
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

        {locked && (
          <p
            role="status"
            className={cn(
              'flex items-start gap-2 rounded-[var(--radius-block)] bg-bg-secondary p-3',
              'text-footnote text-label-secondary',
            )}
          >
            <Lock size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Logging closed — deadline was{' '}
              {habit.timeConstraint ? formatHHmm(habit.timeConstraint) : 'earlier today'}. You can
              still record a skip, and today counts as missed.
            </span>
          </p>
        )}

        {/* Mood — 5-point scale (data-model.md §3). Still available on a skip:
            "skipped, felt tired, at home" is a meaningful data point. */}
        <fieldset>
          <legend className="font-data mb-2.5 text-[10px] text-label-tertiary">How did it feel?</legend>
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
                    'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1.5',
                    'rounded-[var(--radius-block)] px-2 py-2 transition-colors',
                    selected ? 'bg-bg-tertiary' : 'bg-bg-secondary hover:bg-bg-tertiary',
                    mood !== null && !selected && 'opacity-60',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn('size-6 rounded-[8px] transition-transform', selected && 'scale-110')}
                    style={{ backgroundColor: MOOD_COLORS[m] }}
                  />
                  <span className="font-data text-[9px] text-label-tertiary">{MOOD_LABELS[m]}</span>
                </motion.button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-data mb-2.5 text-[10px] text-label-tertiary">Where were you?</legend>
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
          <label htmlFor="log-notes" className="font-data mb-2 block text-[10px] text-label-tertiary">
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
              'w-full resize-none rounded-[var(--radius-block)] bg-white/[0.05] px-4 py-3.5',
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
        'flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-[var(--radius-card)]',
        'font-display text-[17px] transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        selected && tone === 'positive' && 'bg-positive text-black',
        selected && tone === 'neutral' && 'bg-bg-tertiary text-label-primary',
        !selected && 'bg-bg-secondary text-label-secondary hover:bg-bg-tertiary',
      )}
    >
      {icon}
      {label}
    </motion.button>
  );
}
