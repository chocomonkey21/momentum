import type { HabitLog, DifficultyLevel } from '@/db/schema';
import { todayKey, previousDayKey } from './dates';

/** data-model.md §4.1 — the core mechanic. Exact constants, not approximations. */
export const MAX_MOMENTUM = 100;
export const STARTING_MOMENTUM = 50;
export const GAIN = 8;
export const DECAY = 12;

/** Single-step update, exactly as specified in data-model.md §4.1. */
export function updateMomentum(score: number, completedToday: boolean): number {
  return completedToday
    ? Math.min(MAX_MOMENTUM, score + GAIN)
    : Math.max(0, score - DECAY);
}

/**
 * Replay the full momentum history from HabitLog rows.
 *
 * user-flows.md §6 states that any historical edit should recompute momentum by
 * replaying the formula from `HabitLog` rather than patching forward — so replay
 * is the single source of truth here, and the stored `Habit.momentumScore` is a
 * cache of this function's output.
 *
 * ASSUMPTION: today's log is treated asymmetrically — a completed log for today
 * applies GAIN immediately (the user should see momentum move the moment they
 * tap), but an *incomplete* log for today applies NO decay, because the day
 * isn't over yet. This is what makes user-flows.md §6's undo rule
 * ("undo restores the pre-completion value exactly, no decay penalty") fall out
 * of the replay naturally instead of needing a special case. The miss penalty
 * for today lands at end-of-day evaluation (§4.4) once today becomes a past day.
 */
export function replayMomentum(
  logs: Pick<HabitLog, 'date' | 'completed'>[],
  today: string = todayKey(),
): number {
  const ordered = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  let score = STARTING_MOMENTUM;
  for (const log of ordered) {
    if (log.completed === 1) score = Math.min(MAX_MOMENTUM, score + GAIN);
    else if (log.date < today) score = Math.max(0, score - DECAY);
  }
  return score;
}

/**
 * data-model.md §4.1 — `missStreak` is NOT stored; it's derived at read time by
 * counting consecutive most-recent logs with completed = 0, stopping at the
 * first gap or completed day.
 *
 * ASSUMPTION: today's incomplete log is excluded, mirroring replayMomentum's
 * treatment of today — an un-acted-on today shouldn't push a habit into an
 * adaptive-difficulty suggestion before the day has actually ended.
 */
export function missStreak(
  logs: Pick<HabitLog, 'date' | 'completed'>[],
  today: string = todayKey(),
): number {
  const past = logs.filter((l) => l.date < today).sort((a, b) => b.date.localeCompare(a.date));
  let count = 0;
  let expected: string | null = null;
  for (const log of past) {
    if (expected !== null && log.date !== expected) break; // gap
    if (log.completed === 1) break;
    count += 1;
    expected = previousDayKey(log.date);
  }
  return count;
}

/** data-model.md §4.5 — a suggestion, never an automatic change. */
export function adaptiveDifficultySuggestion(
  difficultyLevel: DifficultyLevel,
  currentMissStreak: number,
): DifficultyLevel | null {
  if (currentMissStreak < 3) return null;
  if (difficultyLevel <= 1) return null;
  return (difficultyLevel - 1) as DifficultyLevel;
}

/**
 * Momentum value at the end of each day in `dayKeys`, replaying the same
 * formula as `replayMomentum` so the chart can never disagree with the number
 * on the habit card (user-flows.md §10 — the audited "82% vs four 100% rows"
 * bug was exactly this kind of divergence).
 *
 * Days before the habit's first log are returned as null so Recharts leaves a
 * gap rather than drawing a flat line back to the start of the window.
 */
export function momentumSeries(
  logs: Pick<HabitLog, 'date' | 'completed'>[],
  dayKeys: string[],
  today: string = todayKey(),
): (number | null)[] {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const firstLogged = logs.reduce<string | null>(
    (min, l) => (min === null || l.date < min ? l.date : min),
    null,
  );

  // Seed the running score with everything that happened before the window.
  let score = STARTING_MOMENTUM;
  const windowStart = dayKeys[0];
  for (const log of [...logs].sort((a, b) => a.date.localeCompare(b.date))) {
    if (windowStart !== undefined && log.date >= windowStart) break;
    if (log.completed === 1) score = Math.min(MAX_MOMENTUM, score + GAIN);
    else if (log.date < today) score = Math.max(0, score - DECAY);
  }

  return dayKeys.map((key) => {
    const log = byDate.get(key);
    if (log) {
      if (log.completed === 1) score = Math.min(MAX_MOMENTUM, score + GAIN);
      else if (key < today) score = Math.max(0, score - DECAY);
    }
    if (firstLogged === null || key < firstLogged) return null;
    return score;
  });
}

/** Ring fill color: tint, transitioning to positive as the score climbs past 70.
 *  design-system.md §1.3 momentumRing.fill */
export function momentumIsStrong(score: number): boolean {
  return score >= 70;
}

/** Momentum bands used for copy and warning affordances. */
export function momentumBand(score: number): 'strong' | 'steady' | 'dipping' {
  if (score >= 70) return 'strong';
  if (score >= 40) return 'steady';
  return 'dipping';
}
