'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronLeft, Check } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button, IconButton } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Starburst } from '@/components/ui/Starburst';
import { cn } from '@/lib/cn';
import { spring, reducedFade } from '@/theme/theme';
import { CATEGORIES } from '@/components/habit/AddHabitSheet';
import type { DifficultyLevel, Frequency } from '@/db/schema';

interface Suggestion {
  name: string;
  category: string;
  difficulty: DifficultyLevel;
  frequency: Frequency;
}

/** Suggested habits, ordered by the categories picked in step 2. */
const SUGGESTIONS: Suggestion[] = [
  { name: 'Morning Run', category: 'Fitness', difficulty: 3, frequency: 'daily' },
  { name: 'Stretch for 10 minutes', category: 'Fitness', difficulty: 1, frequency: 'daily' },
  { name: 'Read 20 Pages', category: 'Study', difficulty: 2, frequency: 'daily' },
  { name: 'Revise for an hour', category: 'Study', difficulty: 3, frequency: 'daily' },
  { name: 'Drink 2L of water', category: 'Health', difficulty: 1, frequency: 'daily' },
  { name: 'Sleep by midnight', category: 'Health', difficulty: 2, frequency: 'daily' },
  { name: 'Sketch something', category: 'Creativity', difficulty: 2, frequency: 'daily' },
  { name: 'Journal', category: 'Creativity', difficulty: 2, frequency: 'daily' },
  { name: 'Meditate', category: 'Mind', difficulty: 1, frequency: 'daily' },
  { name: 'No phone for the first hour', category: 'Mind', difficulty: 3, frequency: 'daily' },
  { name: 'Tidy for 10 minutes', category: 'Lifestyle', difficulty: 1, frequency: 'daily' },
  { name: 'Cook a proper meal', category: 'Lifestyle', difficulty: 2, frequency: 'daily' },
  { name: 'Inbox to zero', category: 'Work', difficulty: 2, frequency: 'daily' },
  { name: 'Deep work block', category: 'Work', difficulty: 3, frequency: 'daily' },
];

/**
 * Onboarding, all three steps (ui-spec.md §1–3) in one route with internal step
 * state — the steps share a progress indicator and back stack, and nothing is
 * persisted until "Start Tracking" commits, so they aren't independent routes.
 *
 * user-flows.md §1: zero categories is allowed (they only order suggestions),
 * but at least one habit is REQUIRED before Start Tracking enables — arriving at
 * an empty Home would be a dead end for a first-time user.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { addHabit } = useApp();
  const reduce = useReducedMotion();

  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const ordered = [...SUGGESTIONS].sort((a, b) => {
    const aSel = categories.includes(a.category) ? 0 : 1;
    const bSel = categories.includes(b.category) ? 0 : 1;
    return aSel - bSel;
  });

  async function startTracking() {
    setSaving(true);
    try {
      for (const name of picked) {
        const s = SUGGESTIONS.find((x) => x.name === name);
        if (!s) continue;
        await addHabit({
          name: s.name,
          frequency: s.frequency,
          difficultyLevel: s.difficulty,
          timeConstraint: null,
          categoryTag: s.category,
        });
      }
      router.push('/');
    } catch {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col px-5 pb-8 pt-6 sm:px-8">
      {/* Header: back + 3-dot step indicator (user-flows.md §1 — both were
          flagged missing in the audit and are required here). */}
      <header className="mb-8 flex items-center gap-2">
        {step > 0 ? (
          <IconButton label="Go back a step" className="-ml-3" onClick={() => setStep(step - 1)}>
            <ChevronLeft size={24} aria-hidden />
          </IconButton>
        ) : (
          <span className="size-11" aria-hidden />
        )}
        <div className="flex flex-1 items-center justify-center gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                'h-2 rounded-full transition-all duration-200',
                i === step ? 'w-6 bg-tint' : 'w-2 bg-ink5',
              )}
            />
          ))}
        </div>
        <span className="size-11" aria-hidden />
        <span className="sr-only" role="status">
          Step {step + 1} of 3
        </span>
      </header>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.section
            key="welcome"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={reduce ? reducedFade : spring.default}
            className="flex flex-1 flex-col justify-center"
          >
            <Starburst size={56} className="mb-10 text-tint" strokeWidth={2.5} />
            {/* Wordmark — the one screen with its own dedicated face. */}
            <motion.h1
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, ...(reduce ? reducedFade : spring.default) }}
              // Righteous 50px — the splash wordmark, design-system.md §2.2.
              className="font-wordmark"
            >
              MOMENTUM
            </motion.h1>
            <motion.p
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16, ...(reduce ? reducedFade : spring.default) }}
              className="mt-4 max-w-[30ch] text-body leading-relaxed text-label-secondary"
            >
              Build better days. Miss one and your progress dips — it doesn&rsquo;t disappear.
            </motion.p>
          </motion.section>
        )}

        {step === 1 && (
          <motion.section
            key="goals"
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={reduce ? reducedFade : spring.default}
            className="flex-1"
          >
            {/* Onboarding headline — scoped display-face moment #3. */}
            <h1 className="font-display text-4xl leading-tight">WHAT DO YOU WANT TO IMPROVE?</h1>
            <p className="mt-3 max-w-[34ch] text-body leading-relaxed text-label-secondary">
              Pick any that apply, or skip — this only orders the suggestions next.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  selected={categories.includes(c)}
                  onSelect={() =>
                    setCategories((prev) =>
                      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
                    )
                  }
                >
                  {c}
                </Chip>
              ))}
            </div>
          </motion.section>
        )}

        {step === 2 && (
          <motion.section
            key="habits"
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={reduce ? reducedFade : spring.default}
            className="flex-1"
          >
            <h1 className="font-display text-4xl leading-tight">PICK YOUR FIRST HABITS</h1>
            <p className="mt-3 max-w-[34ch] text-body leading-relaxed text-label-secondary">
              Start small. You can add more any time.
            </p>
            <ul className="mt-6 flex flex-col gap-2">
              {ordered.map((s) => {
                const selected = picked.includes(s.name);
                return (
                  <li key={s.name}>
                    <Chip
                      block
                      selected={selected}
                      onSelect={() =>
                        setPicked((prev) =>
                          prev.includes(s.name)
                            ? prev.filter((x) => x !== s.name)
                            : [...prev, s.name],
                        )
                      }
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'inline-flex size-5 items-center justify-center rounded-full border-2',
                          selected ? 'border-black bg-black/10' : 'border-ink5',
                        )}
                      >
                        {selected && <Check size={12} strokeWidth={3} />}
                      </span>
                      <span className="flex-1">{s.name}</span>
                      <span
                        className={cn(
                          'text-caption1 uppercase tracking-wide',
                          selected ? 'text-black/60' : 'text-label-secondary',
                        )}
                      >
                        {s.category}
                      </span>
                    </Chip>
                  </li>
                );
              })}
            </ul>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Sticky footer CTA. The list above scrolls with enough bottom padding
          that its last item is never hidden behind this (design-system.md §3). */}
      <div className="sticky bottom-0 mt-8 bg-bg-primary pb-2 pt-4">
        {step < 2 ? (
          <Button fullWidth onClick={() => setStep(step + 1)}>
            {step === 0 ? "Let's Go" : 'Continue'}
          </Button>
        ) : (
          <>
            <Button
              fullWidth
              // Required minimum: at least one habit (user-flows.md §1).
              disabled={picked.length === 0}
              loading={saving}
              onClick={startTracking}
            >
              Start Tracking
            </Button>
            {picked.length === 0 && (
              <p className="mt-3 text-footnote text-label-secondary">
                Pick at least one habit to continue.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
