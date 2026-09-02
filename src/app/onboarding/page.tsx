'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronLeft, Check, Plus } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button, IconButton } from '@/components/ui/Button';
import { StarburstSolid } from '@/components/ui/Starburst';
import { cn } from '@/lib/cn';
import { spring, reducedFade, palette, chartHex, onChartHex, categoryHue } from '@/theme/theme';
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
 * Visually it speaks the same language as the app it introduces: solid colour
 * blocks, the burst mark, condensed headlines, the stat pattern. It is not a
 * marketing splash bolted onto a different product.
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
    <main className="flex min-h-dvh flex-col px-5 pb-6 pt-5">
      {/* Header: back + a three-segment progress bar (user-flows.md §1). */}
      <header className="mb-6 flex items-center gap-3">
        {step > 0 ? (
          <IconButton label="Go back a step" className="-ml-3" onClick={() => setStep(step - 1)}>
            <ChevronLeft size={22} aria-hidden />
          </IconButton>
        ) : (
          <span className="-ml-3 size-11" aria-hidden />
        )}
        <div className="flex flex-1 items-center gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-[var(--radius-pill)] transition-colors duration-200',
                i <= step ? 'bg-app-amber' : 'bg-ink4',
              )}
            />
          ))}
        </div>
        <span className="font-data w-11 text-right text-label-tertiary">{step + 1}/3</span>
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
            className="flex flex-1 flex-col"
          >
            {/* One solid amber block carries the whole welcome. The burst is
                static and bleeds off the corner — no ambient motion
                (CLAUDE.md §15: every animation communicates something). */}
            <div
              className="relative flex flex-1 flex-col justify-end overflow-hidden rounded-[var(--radius-sheet)] p-6"
              style={{ backgroundColor: palette.amber, color: palette.ink0 }}
            >
              <div aria-hidden className="absolute -right-12 -top-12 rotate-12">
                <StarburstSolid size={260} className="text-black" />
              </div>

              <div className="relative">
                <p className="font-data text-black/60">Habit tracker</p>
                <h1 className="font-wordmark mt-3 leading-none">MOMENTUM</h1>
                <p className="mt-4 max-w-[26ch] text-body leading-relaxed text-black/75">
                  Build better days. Miss one and your progress dips — it doesn&rsquo;t disappear.
                </p>

                {/* The mechanic, shown rather than explained: a miss costs 12,
                    a win earns 8. The stat pattern, on amber. */}
                <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-black/15 pt-6">
                  <div>
                    <dd className="font-display-hero text-[44px] leading-none">+8</dd>
                    <dt className="font-data mt-2 text-black/60">Per day done</dt>
                  </div>
                  <div>
                    <dd className="font-display-hero text-[44px] leading-none">−12</dd>
                    <dt className="font-data mt-2 text-black/60">Per day missed</dt>
                  </div>
                </dl>
              </div>
            </div>
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
            <p className="font-data text-label-tertiary">Step 2</p>
            <h1 className="font-display mt-2 text-[40px] leading-[0.98]">
              What do you
              <br />
              want to improve?
            </h1>
            <p className="mt-4 max-w-[34ch] text-body leading-relaxed text-label-secondary">
              Pick any that apply, or skip — this only orders the suggestions next.
            </p>

            {/* Category tiles. Each fills with its own hue when picked, so the
                grid becomes a small colour-block mosaic of what you care about. */}
            <ul className="mt-8 grid grid-cols-2 gap-3" role="group" aria-label="Categories">
              {CATEGORIES.map((c) => {
                const on = categories.includes(c);
                const hue = categoryHue(c);
                return (
                  <li key={c}>
                    <motion.button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      whileTap={reduce ? { opacity: 0.8 } : { scale: 0.97 }}
                      transition={reduce ? reducedFade : spring.default}
                      onClick={() =>
                        setCategories((prev) =>
                          prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
                        )
                      }
                      className="flex min-h-[96px] w-full flex-col justify-between rounded-[var(--radius-card)] p-4 text-left transition-colors"
                      style={{
                        backgroundColor: on ? chartHex(hue) : palette.ink2,
                        color: on ? onChartHex(hue) : palette.white,
                      }}
                    >
                      <span
                        aria-hidden
                        className="inline-flex size-7 items-center justify-center rounded-[var(--radius-pill)] border-2"
                        style={{
                          borderColor: on ? 'currentColor' : palette.ink5,
                          backgroundColor: on ? 'currentColor' : 'transparent',
                        }}
                      >
                        {on ? (
                          <Check size={14} strokeWidth={3.5} style={{ color: chartHex(hue) }} />
                        ) : (
                          <Plus size={14} strokeWidth={2.5} className="text-label-tertiary" />
                        )}
                      </span>
                      <span className="font-display text-[22px] leading-none">{c}</span>
                    </motion.button>
                  </li>
                );
              })}
            </ul>
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
            <p className="font-data text-label-tertiary">Step 3</p>
            <h1 className="font-display mt-2 text-[40px] leading-[0.98]">
              Pick your
              <br />
              first habits
            </h1>
            <p className="mt-4 max-w-[34ch] text-body leading-relaxed text-label-secondary">
              Start small. You can add more any time.
            </p>

            <ul className="mt-8 flex flex-col gap-2" role="group" aria-label="Suggested habits">
              {ordered.map((s) => {
                const on = picked.includes(s.name);
                const hue = categoryHue(s.category);
                return (
                  <li key={s.name}>
                    <motion.button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      whileTap={reduce ? { opacity: 0.8 } : { scale: 0.98 }}
                      transition={reduce ? reducedFade : spring.default}
                      onClick={() =>
                        setPicked((prev) =>
                          prev.includes(s.name)
                            ? prev.filter((x) => x !== s.name)
                            : [...prev, s.name],
                        )
                      }
                      className="flex min-h-[64px] w-full items-center gap-4 rounded-[var(--radius-block)] px-4 py-3 text-left transition-colors"
                      style={{
                        backgroundColor: on ? chartHex(hue) : palette.ink2,
                        color: on ? onChartHex(hue) : palette.white,
                      }}
                    >
                      {/* A square of the category's hue when idle; a check on
                          the same square when picked. */}
                      <span
                        aria-hidden
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px]"
                        style={{
                          backgroundColor: on ? 'rgba(0,0,0,0.18)' : chartHex(hue),
                        }}
                      >
                        {on && <Check size={18} strokeWidth={3.5} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-medium">{s.name}</span>
                        <span
                          className="font-data mt-1 block"
                          style={{ opacity: on ? 0.65 : 1, color: on ? 'inherit' : palette.ink7 }}
                        >
                          {s.category}
                        </span>
                      </span>
                    </motion.button>
                  </li>
                );
              })}
            </ul>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Sticky footer CTA. The list above scrolls with enough bottom padding
          that its last item is never hidden behind this (design-system.md §3). */}
      <div className="sticky bottom-0 mt-6 bg-bg-primary pb-2 pt-4">
        {step < 2 ? (
          <Button fullWidth onClick={() => setStep(step + 1)}>
            {step === 0 ? "Let's go" : categories.length === 0 ? 'Skip' : 'Continue'}
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
              {picked.length === 0
                ? 'Start tracking'
                : `Start with ${picked.length} habit${picked.length === 1 ? '' : 's'}`}
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
