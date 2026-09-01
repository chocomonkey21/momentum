import { db, type HabitLog, type MoodTag, type ContextTag, type Habit } from './schema';
import { ensureUser, createHabit, createChain, recomputeMomentum, getActiveHabits } from './queries';
import { toDayKey, todayKey } from '@/lib/dates';

/**
 * seed.ts — demo data.
 *
 * Populates a realistic ~4 weeks of history so every screen (Home, Habit Detail,
 * Statistics, Weekly Recap, Chains, Focus, Friends) renders with live-looking
 * data rather than an accidental empty state. Runs once, only when the database
 * is completely empty; `resetAndReseed()` is wired to Settings for demo reruns.
 *
 * The Friends & Challenges data here is deliberately LOCAL MOCK DATA — the
 * documented Phase 2 fallback in PRD.md §6 ("Mock/seeded friend data is an
 * acceptable stand-in for the demo"). There is no Supabase, no auth, no sync.
 */

const DAYS_OF_HISTORY = 26;

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
  /** Days-ago values that are forced to a miss, to set up specific demo states. */
  forcedMisses?: number[];
  forcedHits?: number[];
}

const SEED_HABITS: SeedHabit[] = [
  {
    // Time-constrained + a live 3-day miss streak, so Habit Detail shows the
    // adaptive-difficulty suggestion (data-model.md §4.5) and Log Habit shows
    // the locked state (ui-spec.md §8) after 09:00 local.
    name: 'Morning Run',
    category: 'Fitness',
    frequency: 'daily',
    difficulty: 3,
    timeConstraint: '09:00',
    rate: 0.55,
    contexts: ['other', 'gym'],
    forcedMisses: [1, 2, 3],
  },
  {
    name: 'Read 20 Pages',
    category: 'Study',
    frequency: 'daily',
    difficulty: 2,
    timeConstraint: null,
    rate: 0.78,
    contexts: ['home', 'work'],
    forcedHits: [1, 2, 4, 5],
  },
  {
    name: 'Meditate',
    category: 'Mind',
    frequency: 'daily',
    difficulty: 1,
    timeConstraint: null,
    rate: 0.86,
    contexts: ['home'],
    forcedHits: [1, 2, 3],
  },
  {
    name: 'Journal',
    category: 'Creativity',
    frequency: 'daily',
    difficulty: 2,
    timeConstraint: null,
    rate: 0.48,
    contexts: ['home', 'work'],
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
      let completed = rand() < spec.rate;
      if (spec.forcedMisses?.includes(ago)) completed = false;
      if (spec.forcedHits?.includes(ago)) completed = true;

      // Weekends are a little weaker for everything except Meditate — gives the
      // insight engine a genuine weekday/weekend correlation to find.
      const dow = new Date(date + 'T00:00:00').getDay();
      if ((dow === 0 || dow === 6) && spec.name !== 'Meditate' && rand() < 0.35) {
        if (!spec.forcedHits?.includes(ago)) completed = false;
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

/** Idempotent: only seeds when the database is genuinely empty. */
export async function seedIfEmpty(): Promise<boolean> {
  const habitCount = await db.habits.count();
  if (habitCount > 0) return false;

  const userId = await ensureUser('Shreyas');
  await seedHabitsAndLogs(userId);
  const habits = await getActiveHabits(userId);
  await seedChains(userId, habits);
  await seedPomodoro(userId, habits);
  await seedFriends(userId);
  await db.settings.add({ notificationsEnabled: 0, reminderTime: '08:00' });
  return true;
}

/** Wipe and reseed — exposed on Settings so a demo can be reset in one tap. */
export async function resetAndReseed(): Promise<void> {
  await db.delete();
  await db.open();
  await seedIfEmpty();
}
