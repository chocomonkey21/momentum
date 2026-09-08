'use client';

import { Lightbulb } from 'lucide-react';

/**
 * Insight card — the "explain the pattern, don't just record it" surface
 * (CLAUDE.md §2). Shared by Habit Detail and Statistics; the copy differs, the
 * component doesn't.
 *
 * `hint` renders the pre-insight state for a habit without enough history yet
 * (ui-spec.md §6 — minimum 3 logged days before attempting a correlation).
 */
export function InsightCard({ text, hint = false }: { text: string; hint?: boolean }) {
  return (
    <div className="flex gap-3 rounded-[var(--radius-card)] bg-bg-secondary p-5">
      <Lightbulb
        size={20}
        className={hint ? 'shrink-0 text-label-secondary' : 'shrink-0 text-warning'}
        aria-hidden
      />
      <div>
        <p className="text-caption1 uppercase tracking-wide text-label-secondary">
          {hint ? 'Not enough data yet' : 'Insight'}
        </p>
        <p className="mt-1 text-body text-label-primary">{text}</p>
      </div>
    </div>
  );
}
