import { db, type Habit, type HabitLog, type Frequency, type MoodTag, type ContextTag } from './schema';
import { replayMomentum } from '@/lib/momentum';
import { todayKey, yesterdayKey, dayKeyRange, dayKeyToDate, toDayKey } from '@/lib/dates';
import { CHART_COLORS, type ChartColor } from '@/theme/theme';

/* ------------------------------------------------------------------ *
 * User
 * ------------------------------------------------------------------ */

/**
 * Same in-flight guard as the seeder, for the same reason: read-then-write is
 * not atomic, so two concurrent callers would each find no user and each create
 * one, breaking the "exactly one local user" invariant in data-model.md §0.
 */
let ensureUserInFlight: Promise<number> | null = null;

/** data-model.md §0 — Phase 1 seeds exactly one implicit local user. */
export function ensureUser(name = 'You'): Promise<number> {
  if (ensureUserInFlight) return ensureUserInFlight;
  ensureUserInFlight = (async () => {
    const existing = await db.users.orderBy('id').first();
    if (existing?.id) return existing.id;
    return db.users.add({ name, username: null, createdAt: new Date().toISOString() });
  })().finally(() => {
    ensureUserInFlight = null;
  });
  return ensureUserInFlight;
}

export async function getUser() {
  return db.users.toCollection().first();
}

export async function updateUserName(userId: number, name: string) {
  await db.users.update(userId, { name });
}

/* ------------------------------------------------------------------ *
 * Scheduling
 * ------------------------------------------------------------------ */

/**
 * Which days a habit is "due".
 *
 * ASSUMPTION: data-model.md defines the `frequency` enum but never specifies
 * which weekday a `weekly` habit falls on, and never defines what `custom`
 * customises (there is no UI in ui-spec.md to configure it). Smallest Phase 1-
 * compatible reading: `daily` and `custom` are due every day, `weekly` is due on
 * the same weekday the habit was created. Revisit if a custom-schedule editor
 * is ever specced.
 */
export function isDueOn(habit: Pick<Habit, 'frequency' | 'createdAt'>, dayKey: string): boolean {
  const freq: Frequency = habit.frequency;
  if (freq === 'daily' || freq === 'custom') return true;
  const created = new Date(habit.createdAt);
  return dayKeyToDate(dayKey).getDay() === created.getDay();
}

/* ------------------------------------------------------------------ *
 * Habits
 * ------------------------------------------------------------------ */

export async function getActiveHabits(userId: number): Promise<Habit[]> {
  const all = await db.habits.where('userId').equals(userId).toArray();
  return all.filter((h) => h.archivedAt === null).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

export async function getHabit(habitId: number) {
  return db.habits.get(habitId);
}

export async function nextChartColor(userId: number): Promise<ChartColor> {
  // data-model.md §2 — assigned round-robin at creation, so a habit's color is
  // stable across the chart, calendar and trend rows.
  const count = await db.habits.where('userId').equals(userId).count();
  return CHART_COLORS[count % CHART_COLORS.length];
}

export async function createHabit(input: {
  userId: number;
  name: string;
  frequency: Frequency;
  difficultyLevel: 1 | 2 | 3;
  timeConstraint?: string | null;
  categoryTag?: string | null;
  createdAt?: string;
}): Promise<number> {
  const chartColor = await nextChartColor(input.userId);
  return db.habits.add({
    userId: input.userId,
    name: input.name.trim(),
    frequency: input.frequency,
    difficultyLevel: input.difficultyLevel,
    momentumScore: 50, // data-model.md §2 — new habits start at the midpoint
    timeConstraint: input.timeConstraint ?? null,
    categoryTag: input.categoryTag ?? null,
    chartColor,
    createdAt: input.createdAt ?? new Date().toISOString(),
    archivedAt: null,
  });
}

/** data-model.md §6 — editing never resets momentumScore or history. */
export async function updateHabit(
  habitId: number,
  patch: Partial<
    Pick<Habit, 'name' | 'frequency' | 'difficultyLevel' | 'timeConstraint' | 'categoryTag'>
  >,
) {
  await db.habits.update(habitId, patch);
}

/** data-model.md §6 — soft delete. History is never removed. */
export async function archiveHabit(habitId: number) {
  await db.habits.update(habitId, { archivedAt: new Date().toISOString() });
  // user-flows.md §8 — also drop it from any chains it belonged to.
  await db.chainHabits.where('habitId').equals(habitId).delete();
}

/** Undo for the "Habit removed" toast — cheap because the delete was soft. */
export async function unarchiveHabit(habitId: number) {
  await db.habits.update(habitId, { archivedAt: null });
}

/** Which chains a habit belongs to — needed for user-flows.md §8 delete copy. */
export async function chainsContainingHabit(habitId: number): Promise<string[]> {
  const rows = await db.chainHabits.where('habitId').equals(habitId).toArray();
  const chains = await Promise.all(rows.map((r) => db.chains.get(r.chainId)));
  return chains.filter(Boolean).map((c) => c!.chainName);
}

/* ------------------------------------------------------------------ *
 * Logs
 * ------------------------------------------------------------------ */

export async function getLogsForHabit(habitId: number): Promise<HabitLog[]> {
  const logs = await db.habitLogs.where('habitId').equals(habitId).toArray();
  return logs.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getAllLogs(habitIds: number[]): Promise<HabitLog[]> {
  if (habitIds.length === 0) return [];
  const logs = await db.habitLogs.where('habitId').anyOf(habitIds).toArray();
  return logs.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * data-model.md §3 — one log per habit per day. Dexie does not enforce
 * uniqueness on a non-primary compound index, so the check lives here rather
 * than being assumed from the schema (§9).
 */
export async function upsertLog(entry: {
  habitId: number;
  date: string;
  completed: 0 | 1;
  moodTag?: MoodTag | null;
  contextTag?: ContextTag | null;
  notes?: string | null;
}): Promise<void> {
  const existing = await db.habitLogs
    .where('[habitId+date]')
    .equals([entry.habitId, entry.date])
    .first();
  const row: Omit<HabitLog, 'id'> = {
    habitId: entry.habitId,
    date: entry.date,
    completed: entry.completed,
    moodTag: entry.moodTag ?? existing?.moodTag ?? null,
    contextTag: entry.contextTag ?? existing?.contextTag ?? null,
    notes: entry.notes ?? existing?.notes ?? null,
    loggedAt: new Date().toISOString(),
  };
  if (existing?.id) await db.habitLogs.update(existing.id, row);
  else await db.habitLogs.add(row as HabitLog);
}

export async function getTodayLog(habitId: number): Promise<HabitLog | undefined> {
  return db.habitLogs.where('[habitId+date]').equals([habitId, todayKey()]).first();
}

/**
 * data-model.md §4.4 — end-of-day evaluation by LAZY READ, not a background job
 * (a browser tab has no reliable persistent background execution). Any un-logged
 * past day on which the habit existed and was due is retroactively recorded as
 * missed before momentum/streak are computed.
 */
export async function backfillMissedDays(habit: Habit): Promise<number> {
  if (!habit.id || habit.archivedAt) return 0;
  const end = yesterdayKey();
  const start = toDayKey(new Date(habit.createdAt));
  if (start > end) return 0;

  const logs = await getLogsForHabit(habit.id);
  const seen = new Set(logs.map((l) => l.date));
  const missing = dayKeyRange(start, end).filter((d) => !seen.has(d) && isDueOn(habit, d));
  if (missing.length === 0) return 0;

  await db.habitLogs.bulkAdd(
    missing.map((date) => ({
      habitId: habit.id as number,
      date,
      completed: 0 as const,
      moodTag: null,
      contextTag: null,
      notes: null,
      loggedAt: new Date().toISOString(),
    })) as HabitLog[],
  );
  return missing.length;
}

/**
 * Recompute and persist a habit's momentum from its full log history.
 * The stored column is a cache of `replayMomentum` (src/lib/momentum.ts) — this
 * is what makes historical edits correct per user-flows.md §6.
 */
export async function recomputeMomentum(habitId: number): Promise<number> {
  const logs = await getLogsForHabit(habitId);
  const score = replayMomentum(logs);
  await db.habits.update(habitId, { momentumScore: score });
  return score;
}

/** Evaluate every active habit on app open: backfill, then recompute. */
export async function evaluateAllHabits(userId: number): Promise<void> {
  const habits = await getActiveHabits(userId);
  for (const h of habits) {
    if (!h.id) continue;
    await backfillMissedDays(h);
    await recomputeMomentum(h.id);
  }
}

/* ------------------------------------------------------------------ *
 * Chains — data-model.md §5
 * ------------------------------------------------------------------ */

export async function getChains(userId: number) {
  const rows = await db.chains.where('userId').equals(userId).toArray();
  return rows.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

export async function getChainMembers(chainId: number) {
  const rows = await db.chainHabits.where('chainId').equals(chainId).toArray();
  return rows.sort((a, b) => a.orderIndex - b.orderIndex);
}

export async function getAllChainMembers() {
  return db.chainHabits.toArray();
}

export async function createChain(userId: number, chainName: string, habitIds: number[]) {
  const chainId = await db.chains.add({
    userId,
    chainName: chainName.trim(),
    createdAt: new Date().toISOString(),
  });
  await db.chainHabits.bulkAdd(
    habitIds.map((habitId, orderIndex) => ({ chainId, habitId, orderIndex })),
  );
  return chainId;
}

export async function saveChainMembers(chainId: number, habitIds: number[]) {
  await db.chainHabits.where('chainId').equals(chainId).delete();
  await db.chainHabits.bulkAdd(
    habitIds.map((habitId, orderIndex) => ({ chainId, habitId, orderIndex })),
  );
}

export async function renameChain(chainId: number, chainName: string) {
  await db.chains.update(chainId, { chainName: chainName.trim() });
}

/** data-model.md §5 — deleting a chain never touches Habit or HabitLog. */
export async function deleteChain(chainId: number) {
  await db.chainHabits.where('chainId').equals(chainId).delete();
  await db.chains.delete(chainId);
}

/* ------------------------------------------------------------------ *
 * Pomodoro — data-model.md §7
 * ------------------------------------------------------------------ */

export async function savePomodoroSession(input: {
  userId: number;
  habitId: number | null;
  startTime: string;
  durationMinutes: number;
  completed: 0 | 1;
}) {
  return db.pomodoroSessions.add({ ...input, endTime: new Date().toISOString() });
}

export async function getPomodoroSessions(userId: number) {
  const rows = await db.pomodoroSessions.where('userId').equals(userId).toArray();
  return rows.sort((a, b) => b.startTime.localeCompare(a.startTime));
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

/**
 * Read-only. Safe to call from a Dexie liveQuery — a liveQuery runs in a
 * readonly transaction, so anything that writes will throw ReadOnlyError.
 */
export async function readSettings() {
  return db.settings.toCollection().first();
}

/** Read-or-create. Call this from the boot effect only, never from a liveQuery. */
export async function getSettings() {
  const s = await readSettings();
  if (s) return s;
  const id = await db.settings.add({ notificationsEnabled: 0, reminderTime: '08:00' });
  return db.settings.get(id);
}

export async function updateSettings(
  id: number,
  patch: { notificationsEnabled?: 0 | 1; reminderTime?: string },
) {
  await db.settings.update(id, patch);
}
