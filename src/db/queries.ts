import { supabase } from '@/lib/supabase';
import {
  toHabit,
  toHabitLog,
  toChain,
  toChainHabit,
  toPomodoro,
  type Habit,
  type HabitLog,
  type HabitChain,
  type ChainHabit,
  type PomodoroSession,
  type Settings,
  type Frequency,
  type MoodTag,
  type ContextTag,
  type HabitRow,
  type HabitLogRow,
  type ChainRow,
  type ChainHabitRow,
  type PomodoroRow,
} from './schema';
import { replayMomentum } from '@/lib/momentum';
import { todayKey, yesterdayKey, dayKeyRange, dayKeyToDate, toDayKey } from '@/lib/dates';
import { CHART_COLORS, type ChartColor } from '@/theme/theme';
import { currentStreak, totalCompletions } from '@/lib/streak';
import { computeAchievements, type AchievementType } from '@/lib/achievements';
import {
  validateChainName,
  validateDisplayName,
  validateHabitName,
  validateNotes,
  validateTimeConstraint,
  validateUsername,
} from '@/lib/validation';

/**
 * Data access, now backed by Supabase/Postgres instead of Dexie/IndexedDB.
 *
 * The exported signatures are deliberately unchanged from the Dexie version so
 * that everything in src/lib/ (momentum, streak, time constraints, insights,
 * recap) keeps working against whatever this module returns without edits.
 *
 * RLS scopes every query to the signed-in user, so `userId` arguments are used
 * for writes and for readability rather than as the security boundary — the
 * database enforces that independently.
 */

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

/**
 * PostgREST caps a response at 1000 rows by default and gives no error when it
 * truncates — it just returns fewer rows than exist.
 *
 * That is genuinely dangerous here: a year of history across four habits is
 * ~1460 log rows, so an un-paginated read silently dropped the most RECENT 460
 * days (the query is ordered ascending). The stored momentum_score still looked
 * right because it lives on the habits table, but today's completion, streaks,
 * the contribution grids and the weekly recap were all computed from a
 * truncated history.
 *
 * Everything that can exceed 1000 rows goes through this.
 */
const PAGE_SIZE = 1000;

async function fetchAllPages<T>(
  context: string,
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    fail(context, error);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) return out;
  }
}

/* ------------------------------------------------------------------ *
 * User
 * ------------------------------------------------------------------ */

/** The signed-in user's id, or null when there is no session. */
export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function getUser() {
  const id = await currentUserId();
  if (!id) return undefined;
  const { data, error } = await supabase
    .from('users')
    .select('id, name, username, created_at')
    .eq('id', id)
    .maybeSingle();
  fail('load profile', error);
  if (!data) return undefined;
  return { id: data.id, name: data.name, username: data.username, createdAt: data.created_at };
}

export async function updateUserName(userId: string, name: string) {
  const validName = validateDisplayName(name);
  const { error } = await supabase.from('users').update({ name: validName }).eq('id', userId);
  fail('rename profile', error);
}

/* ------------------------------------------------------------------ *
 * Scheduling
 * ------------------------------------------------------------------ */

/**
 * ASSUMPTION (unchanged from the Dexie build): data-model.md defines the
 * `frequency` enum but never says which weekday a `weekly` habit falls on, nor
 * what `custom` customises. `daily` and `custom` are due every day; `weekly` is
 * due on the weekday the habit was created.
 */
export function isDueOn(habit: Pick<Habit, 'frequency' | 'createdAt'>, dayKey: string): boolean {
  const freq: Frequency = habit.frequency;
  if (freq === 'daily' || freq === 'custom') return true;
  return dayKeyToDate(dayKey).getDay() === new Date(habit.createdAt).getDay();
}

/* ------------------------------------------------------------------ *
 * Habits
 * ------------------------------------------------------------------ */

export async function getActiveHabits(userId: string): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('id', { ascending: true });
  fail('load habits', error);
  return (data as HabitRow[] | null ?? []).map(toHabit);
}

export async function getHabit(habitId: number): Promise<Habit | undefined> {
  const { data, error } = await supabase.from('habits').select('*').eq('id', habitId).maybeSingle();
  fail('load habit', error);
  return data ? toHabit(data as HabitRow) : undefined;
}

/** data-model.md §2 — assigned round-robin so a habit's colour is stable. */
export async function nextChartColor(userId: string): Promise<ChartColor> {
  const { count, error } = await supabase
    .from('habits')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  fail('count habits', error);
  return CHART_COLORS[(count ?? 0) % CHART_COLORS.length];
}

export async function createHabit(input: {
  userId: string;
  name: string;
  frequency: Frequency;
  difficultyLevel: 1 | 2 | 3;
  timeConstraint?: string | null;
  categoryTag?: string | null;
  createdAt?: string;
}): Promise<number> {
  const name = validateHabitName(input.name);
  const timeConstraint = validateTimeConstraint(input.timeConstraint ?? null);
  const chartColor = await nextChartColor(input.userId);
  const { data, error } = await supabase
    .from('habits')
    .insert({
      user_id: input.userId,
      name,
      frequency: input.frequency,
      difficulty_level: input.difficultyLevel,
      momentum_score: 50, // new habits start at the midpoint
      time_constraint: timeConstraint,
      category_tag: input.categoryTag ?? null,
      chart_color: chartColor,
      created_at: input.createdAt ?? new Date().toISOString(),
    })
    .select('id')
    .single();
  fail('create habit', error);
  return (data as { id: number }).id;
}

/** data-model.md §6 — editing never resets momentumScore or history. */
export async function updateHabit(
  habitId: number,
  patch: Partial<
    Pick<Habit, 'name' | 'frequency' | 'difficultyLevel' | 'timeConstraint' | 'categoryTag'>
  >,
) {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = validateHabitName(patch.name);
  if (patch.frequency !== undefined) row.frequency = patch.frequency;
  if (patch.difficultyLevel !== undefined) row.difficulty_level = patch.difficultyLevel;
  if (patch.timeConstraint !== undefined) row.time_constraint = validateTimeConstraint(patch.timeConstraint);
  if (patch.categoryTag !== undefined) row.category_tag = patch.categoryTag;
  const { error } = await supabase.from('habits').update(row).eq('id', habitId);
  fail('update habit', error);
}

/** data-model.md §6 — soft delete; history is never removed. */
export async function archiveHabit(habitId: number) {
  const { error } = await supabase
    .from('habits')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', habitId);
  fail('archive habit', error);
  // user-flows.md §8 — also drop it from any chains it belonged to.
  await supabase.from('chain_habits').delete().eq('habit_id', habitId);
}

export async function unarchiveHabit(habitId: number) {
  const { error } = await supabase.from('habits').update({ archived_at: null }).eq('id', habitId);
  fail('restore habit', error);
}

/**
 * "Not now" on an adaptive-difficulty suggestion — persists across sessions,
 * unlike the old banner's component-local dismissal state. `until` is a
 * YYYY-MM-DD date; the suggestion stays hidden while todayKey() <= until.
 */
export async function dismissAdaptiveSuggestion(habitId: number, until: string) {
  const { error } = await supabase
    .from('habits')
    .update({ suggestion_dismissed_until: until })
    .eq('id', habitId);
  fail('dismiss suggestion', error);
}

export async function chainsContainingHabit(habitId: number): Promise<string[]> {
  const { data, error } = await supabase
    .from('chain_habits')
    .select('habit_chains(chain_name)')
    .eq('habit_id', habitId);
  fail('load chains for habit', error);
  const rows = (data ?? []) as unknown as { habit_chains: { chain_name: string } | null }[];
  return rows.map((r) => r.habit_chains?.chain_name).filter((n): n is string => Boolean(n));
}

/* ------------------------------------------------------------------ *
 * Logs
 * ------------------------------------------------------------------ */

export async function getLogsForHabit(habitId: number): Promise<HabitLog[]> {
  const rows = await fetchAllPages<HabitLogRow>('load habit logs', (from, to) =>
    supabase
      .from('habit_logs')
      .select('*')
      .eq('habit_id', habitId)
      .order('date', { ascending: true })
      .range(from, to),
  );
  return rows.map(toHabitLog);
}

export async function getAllLogs(habitIds: number[]): Promise<HabitLog[]> {
  if (habitIds.length === 0) return [];
  const rows = await fetchAllPages<HabitLogRow>('load logs', (from, to) =>
    supabase
      .from('habit_logs')
      .select('*')
      .in('habit_id', habitIds)
      .order('date', { ascending: true })
      .range(from, to),
  );
  return rows.map(toHabitLog);
}

/**
 * data-model.md §3 — one log per habit per day.
 *
 * Postgres now enforces this with a real unique constraint on
 * (habit_id, date), so this is a genuine upsert rather than the
 * read-then-write the Dexie version had to do by hand.
 */
export async function upsertLog(entry: {
  habitId: number;
  date: string;
  completed: 0 | 1;
  moodTag?: MoodTag | null;
  contextTag?: ContextTag | null;
  notes?: string | null;
}): Promise<void> {
  const notes = validateNotes(entry.notes ?? null);
  // Preserve any existing mood/context/notes when the quick toggle (which sends
  // none of them) re-writes a day that already had detail logged against it.
  const { data: existing } = await supabase
    .from('habit_logs')
    .select('mood_tag, context_tag, notes')
    .eq('habit_id', entry.habitId)
    .eq('date', entry.date)
    .maybeSingle();

  const { error } = await supabase.from('habit_logs').upsert(
    {
      habit_id: entry.habitId,
      date: entry.date,
      completed: entry.completed === 1,
      mood_tag: entry.moodTag ?? existing?.mood_tag ?? null,
      context_tag: entry.contextTag ?? existing?.context_tag ?? null,
      notes: notes ?? existing?.notes ?? null,
      logged_at: new Date().toISOString(),
    },
    { onConflict: 'habit_id,date' },
  );
  fail('save log', error);
}

export async function getTodayLog(habitId: number): Promise<HabitLog | undefined> {
  const { data, error } = await supabase
    .from('habit_logs')
    .select('*')
    .eq('habit_id', habitId)
    .eq('date', todayKey())
    .maybeSingle();
  fail('load today log', error);
  return data ? toHabitLog(data as HabitLogRow) : undefined;
}

/**
 * data-model.md §4.4 — end-of-day evaluation by LAZY READ. Any un-logged past
 * day on which the habit existed and was due is retroactively recorded as
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

  const { error } = await supabase.from('habit_logs').insert(
    missing.map((date) => ({
      habit_id: habit.id as number,
      date,
      completed: false,
      mood_tag: null,
      context_tag: null,
      notes: null,
      logged_at: new Date().toISOString(),
    })),
  );
  fail('backfill missed days', error);
  return missing.length;
}

/**
 * Recompute and persist momentum from the full log history. The stored column
 * is a cache of replayMomentum(), which is what makes historical edits correct
 * per user-flows.md §6.
 */
export async function recomputeMomentum(habitId: number): Promise<number> {
  const logs = await getLogsForHabit(habitId);
  const score = replayMomentum(logs);
  const { error } = await supabase
    .from('habits')
    .update({ momentum_score: score })
    .eq('id', habitId);
  fail('recompute momentum', error);
  return score;
}

/** Evaluate every active habit on app open: backfill, then recompute. */
export async function evaluateAllHabits(userId: string): Promise<void> {
  const habits = await getActiveHabits(userId);
  for (const h of habits) {
    if (!h.id) continue;
    const filled = await backfillMissedDays(h);
    // Only rewrite momentum when the backfill actually changed something, or
    // when the cached score disagrees with a replay of the logs.
    const logs = await getLogsForHabit(h.id);
    const replayed = replayMomentum(logs);
    if (filled > 0 || Math.round(replayed) !== Math.round(h.momentumScore)) {
      await supabase.from('habits').update({ momentum_score: replayed }).eq('id', h.id);
    }
  }
}

/* ------------------------------------------------------------------ *
 * Chains — data-model.md §5
 * ------------------------------------------------------------------ */

export async function getChains(userId: string): Promise<HabitChain[]> {
  const { data, error } = await supabase
    .from('habit_chains')
    .select('*')
    .eq('user_id', userId)
    .order('id', { ascending: true });
  fail('load chains', error);
  return (data as ChainRow[] | null ?? []).map(toChain);
}

export async function getChainMembers(chainId: number): Promise<ChainHabit[]> {
  const { data, error } = await supabase
    .from('chain_habits')
    .select('*')
    .eq('chain_id', chainId)
    .order('order_index', { ascending: true });
  fail('load chain members', error);
  return (data as ChainHabitRow[] | null ?? []).map(toChainHabit);
}

export async function getAllChainMembers(): Promise<ChainHabit[]> {
  const { data, error } = await supabase.from('chain_habits').select('*');
  fail('load chain members', error);
  return (data as ChainHabitRow[] | null ?? []).map(toChainHabit);
}

export async function createChain(userId: string, chainName: string, habitIds: number[]) {
  const validChainName = validateChainName(chainName);
  const { data, error } = await supabase
    .from('habit_chains')
    .insert({ user_id: userId, chain_name: validChainName })
    .select('id')
    .single();
  fail('create chain', error);
  const chainId = (data as { id: number }).id;
  if (habitIds.length > 0) {
    const { error: memberError } = await supabase
      .from('chain_habits')
      .insert(habitIds.map((habitId, orderIndex) => ({ chain_id: chainId, habit_id: habitId, order_index: orderIndex })));
    fail('add chain members', memberError);
  }
  return chainId;
}

export async function saveChainMembers(chainId: number, habitIds: number[]) {
  const { error: delError } = await supabase.from('chain_habits').delete().eq('chain_id', chainId);
  fail('clear chain members', delError);
  if (habitIds.length === 0) return;
  const { error } = await supabase
    .from('chain_habits')
    .insert(habitIds.map((habitId, orderIndex) => ({ chain_id: chainId, habit_id: habitId, order_index: orderIndex })));
  fail('save chain members', error);
}

export async function renameChain(chainId: number, chainName: string) {
  const validChainName = validateChainName(chainName);
  const { error } = await supabase
    .from('habit_chains')
    .update({ chain_name: validChainName })
    .eq('id', chainId);
  fail('rename chain', error);
}

/** data-model.md §5 — deleting a chain never touches Habit or HabitLog. */
export async function deleteChain(chainId: number) {
  const { error } = await supabase.from('habit_chains').delete().eq('id', chainId);
  fail('delete chain', error);
}

/* ------------------------------------------------------------------ *
 * Pomodoro — data-model.md §7
 * ------------------------------------------------------------------ */

export async function savePomodoroSession(input: {
  userId: string;
  habitId: number | null;
  startTime: string;
  durationMinutes: number;
  completed: 0 | 1;
}) {
  const { data, error } = await supabase
    .from('pomodoro_sessions')
    .insert({
      user_id: input.userId,
      habit_id: input.habitId,
      start_time: input.startTime,
      end_time: new Date().toISOString(),
      duration_minutes: input.durationMinutes,
      completed: input.completed === 1,
    })
    .select('id')
    .single();
  fail('save focus session', error);
  return (data as { id: number }).id;
}

export async function getPomodoroSessions(userId: string): Promise<PomodoroSession[]> {
  const { data, error } = await supabase
    .from('pomodoro_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('start_time', { ascending: false });
  fail('load focus sessions', error);
  return (data as PomodoroRow[] | null ?? []).map(toPomodoro);
}

export async function getUserAchievementState(
  userId: string,
): Promise<Partial<Record<AchievementType, string>>> {
  const { data, error } = await supabase
    .from('user_achievements')
    .select('achievement_type, unlocked_at')
    .eq('user_id', userId);
  fail('load achievements', error);
  return Object.fromEntries(
    ((data ?? []) as { achievement_type: AchievementType; unlocked_at: string }[]).map((row) => [
      row.achievement_type,
      row.unlocked_at,
    ]),
  );
}

/** Evaluate all six rules from the existing source data and persist only new unlocks. */
export async function syncAchievements(userId: string): Promise<AchievementType[]> {
  const habits = await getActiveHabits(userId);
  const logs = await getAllLogs(habits.flatMap((habit) => (habit.id ? [habit.id] : [])));
  const logsByHabit = new Map<number, typeof logs>();
  for (const log of logs) {
    const current = logsByHabit.get(log.habitId) ?? [];
    current.push(log);
    logsByHabit.set(log.habitId, current);
  }
  const currentHabitStreak = Math.max(
    0,
    ...habits.map((habit) => currentStreak(logsByHabit.get(habit.id ?? -1) ?? [])),
  );
  const focusSessions = (await getPomodoroSessions(userId)).filter((session) => session.completed === 1).length;
  const unlocked = await getUserAchievementState(userId);
  const achievements = computeAchievements({
    lifetimeHabitCompletions: totalCompletions(logs),
    currentHabitStreak,
    completedFocusSessions: focusSessions,
    unlockedTypes: unlocked,
  });
  const newlyUnlocked = achievements
    .filter((achievement) => achievement.unlocked && !unlocked[achievement.id])
    .map((achievement) => achievement.id);
  if (newlyUnlocked.length > 0) {
    const { error } = await supabase.from('user_achievements').upsert(
      newlyUnlocked.map((achievement_type) => ({ user_id: userId, achievement_type })),
      { onConflict: 'user_id,achievement_type', ignoreDuplicates: true },
    );
    fail('save achievements', error);
  }
  return newlyUnlocked;
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

export async function readSettings(): Promise<Settings | undefined> {
  const id = await currentUserId();
  if (!id) return undefined;
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', id)
    .maybeSingle();
  fail('load settings', error);
  if (!data) return undefined;
  return {
    userId: data.user_id,
    notificationsEnabled: data.notifications_enabled ? 1 : 0,
    reminderTime: data.reminder_time,
  };
}

/**
 * Read-or-create. The on_auth_user_created trigger normally inserts this row at
 * signup, so this only fills a gap for accounts created before that trigger
 * existed.
 */
export async function getSettings(): Promise<Settings | undefined> {
  const existing = await readSettings();
  if (existing) return existing;
  const id = await currentUserId();
  if (!id) return undefined;
  const { error } = await supabase
    .from('settings')
    .upsert({ user_id: id }, { onConflict: 'user_id' });
  fail('create settings', error);
  return readSettings();
}

export async function updateSettings(
  userId: string,
  patch: { notificationsEnabled?: 0 | 1; reminderTime?: string },
) {
  const row: Record<string, unknown> = {};
  if (patch.notificationsEnabled !== undefined)
    row.notifications_enabled = patch.notificationsEnabled === 1;
  if (patch.reminderTime !== undefined) {
    row.reminder_time = validateTimeConstraint(patch.reminderTime);
  }
  const { error } = await supabase.from('settings').update(row).eq('user_id', userId);
  fail('save settings', error);
}

/* ------------------------------------------------------------------ *
 * Friends & Challenges — data-model.md §8
 *
 * Real rows now, not the seeded local mock the Dexie build used. RLS makes
 * friendships readable from either side (so an incoming request is visible to
 * its recipient) and challenge leaderboards readable by participants.
 * ------------------------------------------------------------------ */

export interface FriendRow {
  id: number;
  status: 'pending' | 'accepted';
  friendUserId: string;
  name: string;
  username: string | null;
  /** True when the other person sent it to us and we haven't accepted. */
  incoming: boolean;
}

export async function getFriends(userId: string): Promise<FriendRow[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('id, status, user_id, friend_user_id')
    .or(`user_id.eq.${userId},friend_user_id.eq.${userId}`);
  fail('load friends', error);

  const rows = (data ?? []) as {
    id: number;
    status: 'pending' | 'accepted';
    user_id: string;
    friend_user_id: string;
  }[];
  if (rows.length === 0) return [];

  // The "other" side of each row, then one lookup for all their profiles.
  const otherIds = rows.map((r) => (r.user_id === userId ? r.friend_user_id : r.user_id));
  const { data: profiles, error: pErr } = await supabase
    .from('users')
    .select('id, name, username')
    .in('id', otherIds);
  fail('load friend profiles', pErr);

  const byId = new Map(
    ((profiles ?? []) as { id: string; name: string; username: string | null }[]).map((p) => [
      p.id,
      p,
    ]),
  );

  return rows.map((r) => {
    const otherId = r.user_id === userId ? r.friend_user_id : r.user_id;
    const p = byId.get(otherId);
    return {
      id: r.id,
      status: r.status,
      friendUserId: otherId,
      name: p?.name ?? 'Unknown',
      username: p?.username ?? null,
      incoming: r.friend_user_id === userId && r.status === 'pending',
    };
  });
}

/**
 * Send a friend request by username.
 *
 * Resolves the handle through find_user_by_username() (migration 0007) — a
 * narrow SECURITY DEFINER RPC that returns id + name for an exact match and
 * nothing else, since RLS otherwise hides every profile row but the caller's
 * own. Every branch below is checked against real backend state (a real
 * account, not the caller, not already connected) before a request is ever
 * inserted — a request can only reach an actual, existing user.
 */
export async function requestFriendByUsername(
  userId: string,
  username: string,
): Promise<{ ok: boolean; message: string }> {
  let validUsername: string;
  try {
    validUsername = validateUsername(username);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Enter a valid username.' };
  }

  const { data, error } = await supabase.rpc('find_user_by_username', {
    p_username: validUsername,
  });
  if (error) return { ok: false, message: 'Could not look up that username.' };
  const match = ((data ?? []) as { id: string; name: string }[])[0];
  if (!match) {
    return { ok: false, message: `No account found with the username "${validUsername}".` };
  }
  if (match.id === userId) return { ok: false, message: "That's your own username." };

  const { data: existing, error: existingErr } = await supabase
    .from('friendships')
    .select('status, user_id')
    .or(
      `and(user_id.eq.${userId},friend_user_id.eq.${match.id}),and(user_id.eq.${match.id},friend_user_id.eq.${userId})`,
    )
    .maybeSingle();
  fail('check existing friendship', existingErr);
  if (existing) {
    const row = existing as { status: 'pending' | 'accepted'; user_id: string };
    if (row.status === 'accepted') {
      return { ok: false, message: `You and ${match.name} are already friends.` };
    }
    return {
      ok: false,
      message:
        row.user_id === userId
          ? `You've already sent ${match.name} a request.`
          : `${match.name} already sent you a request — check Pending.`,
    };
  }

  const { error: insErr } = await supabase
    .from('friendships')
    .insert({ user_id: userId, friend_user_id: match.id, status: 'pending' });
  if (insErr) return { ok: false, message: 'Could not send that request.' };
  return { ok: true, message: `Request sent to ${match.name} (@${validUsername}).` };
}

export interface ChallengeBoard {
  id: number;
  challengeName: string;
  goalMetric: string;
  goalValue: number;
  startDate: string;
  endDate: string;
  board: { userId: string; name: string; progress: number }[];
}

export async function createChallenge(input: {
  userId: string;
  friendUserId: string;
  challengeName: string;
  goalMetric: string;
  goalValue: number;
  startDate: string;
  endDate: string;
}) {
  if (!input.challengeName.trim() || input.challengeName.trim().length > 60) {
    throw new Error('Challenge name must be between 1 and 60 characters.');
  }
  if (!Number.isInteger(input.goalValue) || input.goalValue < 1) {
    throw new Error('Challenge goal must be a positive whole number.');
  }
  if (input.endDate < input.startDate) throw new Error('Challenge deadline must be after its start date.');
  const { data, error } = await supabase
    .from('challenges')
    .insert({
      creator_user_id: input.userId,
      challenge_name: input.challengeName.trim(),
      goal_metric: input.goalMetric.trim() || 'Habit completions',
      goal_value: input.goalValue,
      start_date: input.startDate,
      end_date: input.endDate,
    })
    .select('id')
    .single();
  fail('create challenge', error);
  const challengeId = (data as { id: number }).id;
  const { error: participantError } = await supabase.from('challenge_participants').insert([
    { challenge_id: challengeId, user_id: input.userId, progress: 0 },
    { challenge_id: challengeId, user_id: input.friendUserId, progress: 0 },
  ]);
  fail('add challenge participants', participantError);
  return challengeId;
}

export async function getChallenges(userId: string): Promise<ChallengeBoard[]> {
  const { data, error } = await supabase
    .from('challenges')
    .select('id, challenge_name, goal_metric, goal_value, start_date, end_date')
    .order('id', { ascending: true });
  fail('load challenges', error);

  const challenges = (data ?? []) as {
    id: number;
    challenge_name: string;
    goal_metric: string;
    goal_value: number;
    start_date: string;
    end_date: string;
  }[];
  if (challenges.length === 0) return [];

  const { data: parts, error: pErr } = await supabase
    .from('challenge_participants')
    .select('challenge_id, user_id, progress')
    .in('challenge_id', challenges.map((c) => c.id));
  fail('load challenge participants', pErr);

  const rows = (parts ?? []) as { challenge_id: number; user_id: string; progress: number }[];
  const { data: profiles } = await supabase
    .from('users')
    .select('id, name')
    .in('id', Array.from(new Set(rows.map((r) => r.user_id))));
  const nameById = new Map(
    ((profiles ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]),
  );

  // Keep the signed-in participant's score live from the existing habit logs.
  // Other participants' rows remain protected by RLS and are updated when
  // they open the app, so no user's private logs are exposed here.
  const ownHabits = await getActiveHabits(userId);
  const ownLogs = await getAllLogs(ownHabits.flatMap((habit) => (habit.id ? [habit.id] : [])));
  const ownProgress = new Map(
    challenges.map((challenge) => [
      challenge.id,
      ownLogs.filter(
        (log) => log.completed === 1 && log.date >= challenge.start_date && log.date <= challenge.end_date,
      ).length,
    ]),
  );
  for (const challenge of challenges) {
    const progress = ownProgress.get(challenge.id) ?? 0;
    await supabase
      .from('challenge_participants')
      .update({ progress })
      .eq('challenge_id', challenge.id)
      .eq('user_id', userId);
  }

  return challenges.map((c) => ({
    id: c.id,
    challengeName: c.challenge_name,
    goalMetric: c.goal_metric,
    goalValue: c.goal_value,
    startDate: c.start_date,
    endDate: c.end_date,
    board: rows
      .filter((r) => r.challenge_id === c.id)
      .map((r) => ({
        userId: r.user_id,
        name: r.user_id === userId ? 'You' : (nameById.get(r.user_id) ?? 'Unknown'),
        progress: r.user_id === userId ? ownProgress.get(c.id) ?? r.progress : r.progress,
      }))
      .sort((a, b) => b.progress - a.progress),
  }));
}
