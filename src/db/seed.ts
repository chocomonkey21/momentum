import { db, type HabitLog, type MoodTag, type ContextTag, type Habit } from './schema';
import { ensureUser, createHabit, createChain, recomputeMomentum, getActiveHabits } from './queries';
import { toDayKey, todayKey } from '@/lib/dates';

/**
 * seed.ts — demo data.
 *
 * Populates a realistic full year of history so every screen (Home, Habit Detail,
 * Statistics, Weekly Recap, Chains, Focus, Friends) renders with live-looking
 * data rather than an accidental empty state. Runs once, only when the database
 * is completely empty; `resetAndReseed()` is wired to Settings for demo reruns.
 *
 * The Friends & Challenges data here is deliberately LOCAL MOCK DATA — the
 * documented Phase 2 fallback in PRD.md §6 ("Mock/seeded friend data is an
 * acceptable stand-in for the demo"). There is no Supabase, no auth, no sync.
 */

/**
 * A full year, so the Year view's GitHub-style contribution grids are actually
 * full rather than four weeks of colour floating in a year of empty cells.
 */
const DAYS_OF_HISTORY = 364;

/**
 * Slow seasonal swing applied on top of each habit's base rate.
 *
 * Real habit histories have good months and bad months; a flat probability
 * produces an evenly-speckled grid that looks synthetic. A sine wave over the
 * year gives each habit visible dense and sparse bands — which is the entire
 * point of looking at a year at a glance.
 *
 * It also keeps momentum interesting: at the equilibrium completion rate
 * (GAIN 8 / DECAY 12 balance at p = 0.6) the score is a driftless walk, so the
 * seasonal swing is what pushes it up and down the 0–100 range over time
 * instead of pinning it to a boundary.
 */
const SEASON_AMPLITUDE = 0.2;

function seasonalRate(base: number, dayIndex: number, phase: number): number {
  const swing = SEASON_AMPLITUDE * Math.sin((2 * Math.PI * dayIndex) / 365 + phase);
  return Math.min(0.95, Math.max(0.12, base + swing));
}

/** Small deterministic PRNG so the demo looks identical on every machine. */
function mulberry32(seed: number) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dayKeyAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDayKey(d);
}

interface SeedHabit {
  name: string;
  category: string;
  frequency: 'daily' | 'weekly' | 'custom';
  difficulty: 1 | 2 | 3;
  timeConstraint: string | null;
  /** Base probability a given day was completed — drives momentum variety. */
  rate: number;
  contexts: ContextTag[];
  /**
   * The most recent days, oldest-to-newest, as 1 = completed / 0 = missed.
   *
   * Momentum is dominated by the last dozen days, so over a year of random
   * history the final score reliably pins to 0 or 100 and every habit ends up
   * looking identical. To get a designed spread instead, the seeder saturates
   * each habit to 100 with a short run of forced completions and then replays
   * this exact tail — which makes the ending momentum deterministic and lets
   * each habit land in a different band (and lets Morning Run carry the
   * miss streak that triggers the adaptive-difficulty suggestion).
   */
  tail: (0 | 1)[];
}

/** Forced completions before the tail — enough to pin momentum at MAX. */
const SATURATION_RUN = 13;

const SEED_HABITS: SeedHabit[] = [
  {
    // Time-constrained + a live 4-day miss streak, so Habit Detail shows the
    // adaptive-difficulty suggestion (data-model.md §4.5) and Log Habit shows
    // the locked state (ui-spec.md §8) after 09:00 local.
    name: 'Morning Run',
    category: 'Fitness',
    frequency: 'daily',
    difficulty: 3,
    timeConstraint: '09:00',
    rate: 0.62,
    contexts: ['other', 'gym'],
    // Ends on a five-day miss run -> momentum 40, missStreak 5.
    tail: [1, 0, 0, 0, 0, 0],
  },
  {
    name: 'Read 20 Pages',
    category: 'Study',
    frequency: 'daily',
    difficulty: 2,
    timeConstraint: null,
    rate: 0.62,
    contexts: ['home', 'work'],
    // -> momentum 80, the strongest of the four.
    tail: [0, 0, 0, 1, 1],
  },
  {
    name: 'Meditate',
    category: 'Mind',
    frequency: 'daily',
    difficulty: 1,
    timeConstraint: null,
    rate: 0.64,
    contexts: ['home'],
    // -> momentum 56.
    tail: [0, 0, 0, 0, 0, 1, 1],
  },
  {
    name: 'Journal',
    category: 'Creativity',
    frequency: 'daily',
    difficulty: 2,
    timeConstraint: null,
    rate: 0.58,
    contexts: ['home', 'work'],
    // -> momentum 32, the one that is visibly slipping.
    tail: [0, 0, 0, 0, 0, 0, 1, 0, 1],
  },
];

function moodFor(rand: () => number, completed: boolean): MoodTag {
  // Completed days skew happier — this is what makes the insight engine and the
  // mood calendar show a real, readable pattern rather than noise.
  const roll = rand();
  if (completed) return (roll > 0.55 ? 5 : roll > 0.2 ? 4 : 3) as MoodTag;
  return (roll > 0.7 ? 3 : roll > 0.3 ? 2 : 1) as MoodTag;
}

const NOTES_DONE = [
  'Felt easy today.',
  'Nearly skipped, glad I did it.',
  'Best one this week.',
  '',
  '',
  'Short version, but it counts.',
];
const NOTES_MISSED = ['Ran out of time.', 'Too tired.', '', '', 'Travelling today.'];

async function seedHabitsAndLogs(userId: number) {
  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - DAYS_OF_HISTORY);

  for (let i = 0; i < SEED_HABITS.length; i++) {
    const spec = SEED_HABITS[i];
    const rand = mulberry32(1337 + i * 977);

    const habitId = await createHabit({
      userId,
      name: spec.name,
      frequency: spec.frequency,
      difficultyLevel: spec.difficulty,
      timeConstraint: spec.timeConstraint,
      categoryTag: spec.category,
      createdAt: createdAt.toISOString(),
    });

    const logs: Omit<HabitLog, 'id'>[] = [];
    // Walk oldest -> most recent. Today is deliberately left UNLOGGED so the
    // demo has something live to tap (interaction-spec.md §3).
    for (let ago = DAYS_OF_HISTORY; ago >= 1; ago--) {
      const date = dayKeyAgo(ago);
      const dayIndex = DAYS_OF_HISTORY - ago;
      let completed = rand() < seasonalRate(spec.rate, dayIndex, i * 1.7);

      // Deterministic ending: saturate, then replay the designed tail.
      const tailPos = spec.tail.length - ago; // 0-based index into the tail
      const inTail = tailPos >= 0;
      const inSaturationRun = !inTail && ago <= spec.tail.length + SATURATION_RUN;
      if (inTail) completed = spec.tail[tailPos] === 1;
      else if (inSaturationRun) completed = true;

      // Weekends are a little weaker for everything except Meditate — gives the
      // insight engine a genuine weekday/weekend correlation to find.
      const dow = new Date(date + 'T00:00:00').getDay();
      if (
        (dow === 0 || dow === 6) &&
        spec.name !== 'Meditate' &&
        !inTail &&
        !inSaturationRun &&
        rand() < 0.35
      ) {
        completed = false;
      }

      const contextPool = spec.contexts;
      logs.push({
        habitId,
        date,
        loggedAt: new Date(date + 'T20:00:00').toISOString(),
        completed: completed ? 1 : 0,
        moodTag: rand() < 0.85 ? moodFor(rand, completed) : null,
        contextTag:
          rand() < 0.8 ? contextPool[Math.floor(rand() * contextPool.length)] ?? 'home' : null,
        notes:
          rand() < 0.3
            ? (completed ? NOTES_DONE : NOTES_MISSED)[
                Math.floor(rand() * (completed ? NOTES_DONE.length : NOTES_MISSED.length))
              ] || null
            : null,
      });
    }

    await db.habitLogs.bulkAdd(logs as HabitLog[]);
    await recomputeMomentum(habitId);
  }
}

async function seedChains(userId: number, habits: Habit[]) {
  const byName = (n: string) => habits.find((h) => h.name === n)?.id;
  const morning = [byName('Meditate'), byName('Morning Run'), byName('Read 20 Pages')].filter(
    (x): x is number => typeof x === 'number',
  );
  const evening = [byName('Journal'), byName('Meditate')].filter(
    (x): x is number => typeof x === 'number',
  );
  if (morning.length) await createChain(userId, 'Morning Routine', morning);
  if (evening.length) await createChain(userId, 'Wind Down', evening);
}

async function seedPomodoro(userId: number, habits: Habit[]) {
  const read = habits.find((h) => h.name === 'Read 20 Pages')?.id ?? null;
  const journal = habits.find((h) => h.name === 'Journal')?.id ?? null;
  const plan: Array<[number, number, number | null, 0 | 1]> = [
    // [days ago, duration, linked habit, completed]
    [0, 25, read, 1],
    [1, 45, read, 1],
    [1, 25, null, 0],
    [2, 25, journal, 1],
    [4, 60, read, 1],
    [5, 25, null, 1],
  ];
  for (const [ago, durationMinutes, habitId, completed] of plan) {
    const start = new Date();
    start.setDate(start.getDate() - ago);
    start.setHours(9 + (ago % 6), 15, 0, 0);
    const end = new Date(start.getTime() + durationMinutes * 60000);
    await db.pomodoroSessions.add({
      userId,
      habitId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationMinutes,
      completed,
    });
  }
}

/**
 * Phase 2 mock social graph. These friend Users are seeded records only — they
 * are never authenticated, never synced, and exist purely to make the Friends &
 * Challenges screens demoable (PRD.md §6).
 */
async function seedFriends(userId: number) {
  const friends = [
    { name: 'Priya Nair', username: 'priya', momentum: 84, streak: 12 },
    { name: 'Aditya Rao', username: 'adi', momentum: 71, streak: 5 },
    { name: 'Sam Whitfield', username: 'sam.w', momentum: 46, streak: 2 },
  ];

  const ids: number[] = [];
  for (const f of friends) {
    const id = await db.users.add({
      name: f.name,
      username: f.username,
      createdAt: new Date().toISOString(),
    });
    ids.push(id);
  }

  await db.friendships.bulkAdd([
    { userId, friendUserId: ids[0], status: 'accepted', createdAt: new Date().toISOString() },
    { userId, friendUserId: ids[1], status: 'accepted', createdAt: new Date().toISOString() },
    { userId, friendUserId: ids[2], status: 'pending', createdAt: new Date().toISOString() },
  ]);

  const start = dayKeyAgo(5);
  const end = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 9);
    return toDayKey(d);
  })();

  const c1 = await db.challenges.add({
    creatorUserId: ids[0],
    challengeName: 'Two-Week Momentum Push',
    goalMetric: 'Total momentum gained',
    startDate: start,
    endDate: end,
  });
  const c2 = await db.challenges.add({
    creatorUserId: userId,
    challengeName: 'No-Zero Days',
    goalMetric: 'Days with at least one habit completed',
    startDate: dayKeyAgo(12),
    endDate: todayKey(),
  });

  await db.challengeParticipants.bulkAdd([
    { challengeId: c1, userId, progress: 62 },
    { challengeId: c1, userId: ids[0], progress: 78 },
    { challengeId: c1, userId: ids[1], progress: 55 },
    { challengeId: c2, userId, progress: 11 },
    { challengeId: c2, userId: ids[1], progress: 9 },
    { challengeId: c2, userId: ids[2], progress: 12 },
  ]);
}

/**
 * Set when the user deliberately chooses "Start fresh" in Settings, so the
 * seeder doesn't immediately refill the database they just emptied and send
 * them straight past onboarding.
 */
const SUPPRESS_KEY = 'momentum:suppress-seed';

function seedSuppressed(): boolean {
  try {
    return localStorage.getItem(SUPPRESS_KEY) === '1';
  } catch {
    // Private mode or blocked storage — fall back to seeding, which is the
    // better default for a demo build.
    return false;
  }
}

function setSeedSuppressed(value: boolean) {
  try {
    if (value) localStorage.setItem(SUPPRESS_KEY, '1');
    else localStorage.removeItem(SUPPRESS_KEY);
  } catch {
    /* storage unavailable — nothing to do */
  }
}

/**
 * In-flight guard.
 *
 * The "is it empty?" check and the writes that follow are not atomic, so two
 * overlapping callers both see an empty database and both seed it — which
 * produced a duplicate user and duplicate challenges. React's Strict Mode
 * double-invokes effects in development, so this fires on literally every dev
 * boot; two tabs opening at once would do the same in production. Sharing one
 * promise makes concurrent callers await the same seed instead of racing it.
 */
let seedInFlight: Promise<boolean> | null = null;

/** Idempotent: only seeds when the database is genuinely empty. */
export function seedIfEmpty(): Promise<boolean> {
  if (seedInFlight) return seedInFlight;
  seedInFlight = (async () => {
    if (seedSuppressed()) return false;
    const habitCount = await db.habits.count();
    if (habitCount > 0) return false;

    const userId = await ensureUser('Shreyas');
    await seedHabitsAndLogs(userId);
    const habits = await getActiveHabits(userId);
    await seedChains(userId, habits);
    await seedPomodoro(userId, habits);
    await seedFriends(userId);
    if ((await db.settings.count()) === 0) {
      await db.settings.add({ notificationsEnabled: 0, reminderTime: '08:00' });
    }
    return true;
  })().finally(() => {
    seedInFlight = null;
  });
  return seedInFlight;
}

/** Wipe and reseed — exposed on Settings so a demo can be reset in one tap. */
export async function resetAndReseed(): Promise<void> {
  setSeedSuppressed(false);
  await db.delete();
  await db.open();
  await seedIfEmpty();
}

/**
 * Wipe to a genuinely empty state and keep it empty, so the real first-time-user
 * flow (user-flows.md §1) can be demoed. Without the suppression flag the seeder
 * would refill the database on the very next boot and skip onboarding entirely.
 */
export async function startFresh(): Promise<void> {
  setSeedSuppressed(true);
  await db.delete();
  await db.open();
}
