'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { z } from 'zod';
import { cn } from '@/lib/cn';
import { spring, reducedFade } from '@/theme/theme';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { isValidHHmm } from '@/lib/dates';
import type { Frequency, DifficultyLevel } from '@/db/schema';

/** data-model.md §2 validation, expressed once as a zod schema. */
const habitSchema = z.object({
  name: z.string().trim().min(1, 'Give your habit a name.').max(60, 'Keep the name under 60 characters.'),
  timeConstraint: z
    .string()
    .nullable()
    .refine((v) => v === null || isValidHHmm(v), 'Enter a valid time, like 09:00.'),
});

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom' },
];

const DIFFICULTIES: { value: DifficultyLevel; label: string }[] = [
  { value: 1, label: 'Easy' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'Hard' },
];

export const CATEGORIES = ['Fitness', 'Study', 'Health', 'Creativity', 'Mind', 'Lifestyle', 'Work'];

export interface HabitDraft {
  name: string;
  frequency: Frequency;
  difficultyLevel: DifficultyLevel;
  timeConstraint: string | null;
  categoryTag: string | null;
}

/**
 * Add / Edit Habit (ui-spec.md §7), presented as a modal sheet per
 * interaction-spec.md §7. Frequency and Difficulty are SINGLE-select chip rows —
 * deliberately not the multi-select variant used in onboarding.
 */
export function AddHabitSheet({
  open,
  onOpenChange,
  onSubmit,
  initial,
  mode = 'create',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: HabitDraft) => Promise<void>;
  initial?: Partial<HabitDraft>;
  mode?: 'create' | 'edit';
}) {
  const reduce = useReducedMotion();
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initial?.name ?? '');
  const [frequency, setFrequency] = useState<Frequency>(initial?.frequency ?? 'daily');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(initial?.difficultyLevel ?? 2);
  const [category, setCategory] = useState<string | null>(initial?.categoryTag ?? null);
  const [constraintOn, setConstraintOn] = useState(Boolean(initial?.timeConstraint));
  const [time, setTime] = useState(initial?.timeConstraint ?? '09:00');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset the form to the incoming values each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setFrequency(initial?.frequency ?? 'daily');
    setDifficulty(initial?.difficultyLevel ?? 2);
    setCategory(initial?.categoryTag ?? null);
    setConstraintOn(Boolean(initial?.timeConstraint));
    setTime(initial?.timeConstraint ?? '09:00');
    setError(null);
    setSaving(false);
    // Name is the primary and often only required field — focus it on mount.
    const t = setTimeout(() => nameRef.current?.focus(), 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit() {
    const parsed = habitSchema.safeParse({
      name,
      timeConstraint: constraintOn ? time : null,
    });
    if (!parsed.success) {
      // Shake only on submit-attempt, never on every keystroke (§5).
      setError(parsed.error.issues[0].message);
      setShake(true);
      setTimeout(() => setShake(false), 220);
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        name: parsed.data.name,
        frequency,
        difficultyLevel: difficulty,
        timeConstraint: parsed.data.timeConstraint,
        categoryTag: category,
      });
      onOpenChange(false);
    } catch {
      setError("We couldn't save that habit. Try again.");
      setSaving(false);
    }
  }

  const nameEmpty = name.trim().length === 0;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? 'Add New Habit' : 'Edit Habit'}
      description={mode === 'create' ? 'New habits start at the midpoint — 50 momentum.' : undefined}
    >
      <div className="flex flex-col gap-6">
        <div>
          <label htmlFor="habit-name" className="mb-2 block text-subheadline text-label-secondary">
            Habit name
          </label>
          <input
            ref={nameRef}
            id="habit-name"
            value={name}
            maxLength={80}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              // Enter advances rather than submitting blind (interaction-spec.md §15).
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.currentTarget.closest('div')?.nextElementSibling?.querySelector('button') as
                  | HTMLButtonElement
                  | null)?.focus();
              }
            }}
            placeholder="Morning Run"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'habit-name-error' : undefined}
            className={cn(
              'w-full rounded-[var(--radius-chip)] bg-bg-secondary px-4 py-3',
              'text-body text-label-primary placeholder:text-label-tertiary',
              'border transition-colors duration-150',
              error ? 'border-destructive' : 'border-transparent focus:border-tint',
              shake && 'shake',
            )}
          />
          {error && (
            <p id="habit-name-error" role="alert" className="mt-2 text-footnote text-destructive">
              {error}
            </p>
          )}
        </div>

        <Fieldset legend="Frequency">
          {FREQUENCIES.map((f) => (
            <Chip
              key={f.value}
              selected={frequency === f.value}
              dimmed
              onSelect={() => setFrequency(f.value)}
            >
              {f.label}
            </Chip>
          ))}
        </Fieldset>

        <Fieldset legend="Difficulty">
          {DIFFICULTIES.map((d) => (
            <Chip
              key={d.value}
              selected={difficulty === d.value}
              dimmed
              onSelect={() => setDifficulty(d.value)}
            >
              {d.label}
            </Chip>
          ))}
        </Fieldset>

        <Fieldset legend="Category">
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              selected={category === c}
              dimmed
              onSelect={() => setCategory(category === c ? null : c)}
            >
              {c}
            </Chip>
          ))}
        </Fieldset>

        {/* Optional, visually secondary, collapsed by default (ui-spec.md §7). */}
        <div>
          <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-4">
            <span>
              <span className="block text-body text-label-primary">Time constraint</span>
              <span className="block text-footnote text-label-secondary">
                Block logging after a deadline each day
              </span>
            </span>
            <input
              type="checkbox"
              checked={constraintOn}
              onChange={(e) => setConstraintOn(e.target.checked)}
              className="size-6 accent-[var(--color-tint)]"
            />
          </label>

          <AnimatePresence initial={false}>
            {constraintOn && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={reduce ? reducedFade : spring.default}
                className="overflow-hidden"
              >
                <div className="pt-3">
                  <label htmlFor="habit-time" className="sr-only">
                    Deadline time
                  </label>
                  <input
                    id="habit-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className={cn(
                      'w-full rounded-[var(--radius-chip)] bg-bg-secondary px-4 py-3',
                      'text-body text-label-primary [color-scheme:dark]',
                      'border border-transparent focus:border-tint',
                    )}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Button onClick={submit} disabled={nameEmpty} loading={saving} fullWidth>
          {mode === 'create' ? 'Create Habit' : 'Save Changes'}
        </Button>
      </div>
    </Sheet>
  );
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-subheadline text-label-secondary">{legend}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}
