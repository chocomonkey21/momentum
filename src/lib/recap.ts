import type { HabitLog } from '@/db/schema';

/** ui-spec.md §12 — one generated recap card per active habit for the past 7 days. */
export type Verdict = 'Strong week' | 'Steady' | 'Slipping';

export interface HabitRecap {
  habitId: number;
  habitName: string;
  completions: number;
  outOf: number;
  verdict: Verdict;
  sentence: string;
}

export function verdictFor(completions: number, outOf: number): Verdict {
  if (outOf === 0) return 'Steady';
  const r = completions / outOf;
  if (r >= 0.7) return 'Strong week';
  if (r >= 0.4) return 'Steady';
  return 'Slipping';
}

/**
 * Generated sentence — narrative, not a restated number (PRD.md §7 Weekly Recap:
 * "a quick narrative read on the week without parsing raw numbers").
 */
export function recapSentence(
  habitName: string,
  completions: number,
  outOf: number,
  bestDay: string | null,
  momentumDelta: number,
): string {
  const verdict = verdictFor(completions, outOf);
  const delta =
    momentumDelta > 0
      ? `Momentum climbed ${momentumDelta} points.`
      : momentumDelta < 0
        ? `Momentum slipped ${Math.abs(momentumDelta)} points — recoverable, not lost.`
        : 'Momentum held flat.';

  if (verdict === 'Strong week') {
    return `${habitName} carried the week — ${completions} of ${outOf} days done${
      bestDay ? `, with ${bestDay} your most reliable day` : ''
    }. ${delta}`;
  }
  if (verdict === 'Steady') {
    return `${habitName} kept ticking along at ${completions} of ${outOf} days${
      bestDay ? `, strongest on ${bestDay}` : ''
    }. ${delta}`;
  }
  return `${habitName} only landed ${completions} of ${outOf} days this week. ${delta} One good day starts the climb back.`;
}

export function bestDayOfWeek(logs: HabitLog[]): string | null {
  const names = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
  const counts = new Array(7).fill(0);
  for (const l of logs) {
    if (l.completed === 1) counts[new Date(l.date + 'T00:00:00').getDay()] += 1;
  }
  const max = Math.max(...counts);
  if (max === 0) return null;
  return names[counts.indexOf(max)];
}
