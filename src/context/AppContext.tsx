'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  type Habit,
  type HabitLog,
  type HabitChain,
  type ChainHabit,
  type MoodTag,
  type ContextTag,
  type Frequency,
  type DifficultyLevel,
} from '@/db/schema';
import * as q from '@/db/queries';
import { useAuth } from './AuthContext';
import { todayKey } from '@/lib/dates';
import { currentStreak } from '@/lib/streak';
import { missStreak } from '@/lib/momentum';
import { canLogToday } from '@/lib/timeConstraint';
import { ACHIEVEMENT_DEFINITIONS, type AchievementDefinition, type AchievementType } from '@/lib/achievements';

/**
 * App data.
 *
 * Dexie's useLiveQuery gave this for free; Postgres over HTTP does not, so the
 * provider now owns an explicit snapshot and every mutation calls refresh().
 * That keeps the one behaviour the old reactivity was actually buying us —
 * completing a habit on Home updating chain progress on the Habits screen
 * (ui-spec.md §9) — without pulling in Supabase Realtime for a single-user app.
 *
 * Screens still read derived data from here and call actions; components below
 * them stay presentational and never query the database themselves
 * (CLAUDE.md §6).
 */

export type Status = 'loading' | 'ready' | 'error';

export interface HabitView extends Habit {
  id: number;
  logs: HabitLog[];
  todayLog: HabitLog | undefined;
  streak: number;
  missStreak: number;
  isDueToday: boolean;
  /** True once today's time constraint has passed (data-model.md §4.3). */
  locked: boolean;
}

interface HabitDraft {
  name: string;
  frequency: Frequency;
  difficultyLevel: DifficultyLevel;
  timeConstraint: string | null;
  categoryTag: string | null;
}

interface AppValue {
  status: Status;
  errorMessage: string | null;
  retry: () => void;
  userId: string | null;
  userName: string;
  habits: HabitView[];
  allLogs: HabitLog[];
  chains: HabitChain[];
  chainMembers: ChainHabit[];
  notificationsEnabled: boolean;
  reminderTime: string;
  settingsId: string | null;
  toast: { message: string; actionLabel?: string; onAction?: () => void } | null;
  showToast: (message: string, actionLabel?: string, onAction?: () => void) => void;
  dismissToast: () => void;
  refresh: () => Promise<void>;
  setCompletion: (habitId: number, completed: boolean) => Promise<void>;
  /** Set once, app-wide, whenever an achievement threshold is newly crossed —
   *  drives the celebration overlay mounted in AuthGate. */
  celebration: AchievementDefinition | null;
  dismissCelebration: () => void;
  /** Looks up the first newly-unlocked type from syncAchievements() and fires
   *  the celebration for it. Exposed so Focus (Pomodoro completions aren't
   *  routed through setCompletion/saveLog) can trigger the same payoff. */
  notifyAchievementUnlocks: (unlocked: AchievementType[]) => void;
  saveLog: (
    habitId: number,
    draft: {
      completed: boolean;
      moodTag: MoodTag | null;
      contextTag: ContextTag | null;
      notes: string | null;
    },
    date?: string,
  ) => Promise<void>;
  addHabit: (draft: HabitDraft) => Promise<void>;
  editHabit: (habitId: number, draft: HabitDraft) => Promise<void>;
  removeHabit: (habitId: number) => Promise<void>;
  chainNamesForHabit: (habitId: number) => string[];
  refreshHabit: (habitId: number) => Promise<void>;
  /** "Not now" on an adaptive-difficulty suggestion — hides it for 7 days. */
  dismissSuggestion: (habitId: number) => Promise<void>;
}

const AppContext = createContext<AppValue | null>(null);

interface Snapshot {
  habits: Habit[];
  logs: HabitLog[];
  chains: HabitChain[];
  chainMembers: ChainHabit[];
  userName: string;
  notificationsEnabled: boolean;
  reminderTime: string;
}

const EMPTY: Snapshot = {
  habits: [],
  logs: [],
  chains: [],
  chainMembers: [],
  userName: 'there',
  notificationsEnabled: false,
  reminderTime: '08:00',
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { status: authStatus, userId } = useAuth();

  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<Snapshot>(EMPTY);
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState<AppValue['toast']>(null);

  /** Guards against a slow refresh landing after a newer one. */
  const loadSeq = useRef(0);

  const load = useCallback(
    async (uid: string, opts: { evaluate?: boolean } = {}) => {
      const seq = ++loadSeq.current;
      try {
        if (opts.evaluate) {
          // data-model.md §4.4 — lazy end-of-day evaluation before anything
          // renders real numbers.
          await q.evaluateAllHabits(uid);
          await q.getSettings();
        }

        const habits = await q.getActiveHabits(uid);
        const ids = habits.map((h) => h.id).filter((x): x is number => typeof x === 'number');
        const [logs, chains, chainMembers, profile, settings] = await Promise.all([
          q.getAllLogs(ids),
          q.getChains(uid),
          q.getAllChainMembers(),
          q.getUser(),
          q.readSettings(),
        ]);

        if (seq !== loadSeq.current) return; // superseded
        setData({
          habits,
          logs,
          chains,
          chainMembers,
          userName: profile?.name ?? 'there',
          notificationsEnabled: settings?.notificationsEnabled === 1,
          reminderTime: settings?.reminderTime ?? '08:00',
        });
        setErrorMessage(null);
        setStatus('ready');
      } catch (err) {
        if (seq !== loadSeq.current) return;
        console.error('[Momentum] load failed', err);
        setErrorMessage(
          "We couldn't reach your habits just now. Check your connection and try again.",
        );
        setStatus('error');
      }
    },
    [],
  );

  useEffect(() => {
    if (authStatus === 'loading') {
      setStatus('loading');
      return;
    }
    if (authStatus === 'signedOut' || !userId) {
      setData(EMPTY);
      setStatus('ready');
      return;
    }
    setStatus('loading');
    void load(userId, { evaluate: true });
  }, [authStatus, userId, attempt, load]);

  const refresh = useCallback(async () => {
    if (userId) await load(userId);
  }, [userId, load]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const today = todayKey();

  const habits: HabitView[] = useMemo(() => {
    const byHabit = new Map<number, HabitLog[]>();
    for (const log of data.logs) {
      const list = byHabit.get(log.habitId);
      if (list) list.push(log);
      else byHabit.set(log.habitId, [log]);
    }
    return data.habits
      .filter((h): h is Habit & { id: number } => typeof h.id === 'number')
      .map((h) => {
        const logs = (byHabit.get(h.id) ?? []).sort((a, b) => a.date.localeCompare(b.date));
        const todayLog = logs.find((l) => l.date === today);
        return {
          ...h,
          logs,
          todayLog,
          streak: currentStreak(logs, today),
          missStreak: missStreak(logs, today),
          isDueToday: q.isDueOn(h, today),
          // Already-completed habits never render as locked — the lockout only
          // blocks *marking* something done after the deadline (§4.3).
          locked: !canLogToday(h.timeConstraint) && todayLog?.completed !== 1,
        };
      });
  }, [data.habits, data.logs, today]);

  const showToast = useCallback((message: string, actionLabel?: string, onAction?: () => void) => {
    setToast({ message, actionLabel, onAction });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const [celebration, setCelebration] = useState<AchievementDefinition | null>(null);
  const dismissCelebration = useCallback(() => setCelebration(null), []);
  const notifyAchievementUnlocks = useCallback((unlocked: AchievementType[]) => {
    if (unlocked.length === 0) return;
    const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === unlocked[0]);
    if (def) setCelebration(def);
  }, []);

  const refreshHabit = useCallback(
    async (habitId: number) => {
      await q.recomputeMomentum(habitId);
      await refresh();
    },
    [refresh],
  );

  const dismissSuggestion = useCallback(
    async (habitId: number) => {
      const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await q.dismissAdaptiveSuggestion(habitId, until);
      await refresh();
    },
    [refresh],
  );

  /** user-flows.md §5 / §6 — the write path behind the optimistic toggle. */
  const setCompletion = useCallback(
    async (habitId: number, completed: boolean) => {
      try {
        await q.upsertLog({ habitId, date: todayKey(), completed: completed ? 1 : 0 });
        await q.recomputeMomentum(habitId);
        await refresh();
        if (userId && completed) {
          notifyAchievementUnlocks(await q.syncAchievements(userId));
        }
      } catch (err) {
        console.error('[Momentum] failed to save completion', err);
        showToast("Couldn't save that — tap to retry", 'Retry', () => {
          void setCompletion(habitId, completed);
        });
        await refresh();
      }
    },
    [refresh, showToast, userId, notifyAchievementUnlocks],
  );

  const saveLog = useCallback<AppValue['saveLog']>(
    async (habitId, draft, date) => {
      try {
        await q.upsertLog({
          habitId,
          date: date ?? todayKey(),
          completed: draft.completed ? 1 : 0,
          moodTag: draft.moodTag,
          contextTag: draft.contextTag,
          notes: draft.notes,
        });
        await q.recomputeMomentum(habitId);
        await refresh();
        let unlockedSomething = false;
        if (userId && draft.completed) {
          const unlocked = await q.syncAchievements(userId);
          unlockedSomething = unlocked.length > 0;
          notifyAchievementUnlocks(unlocked);
        }
        // The celebration overlay is the payoff when one fires — a toast
        // underneath it would be noise the user can't read anyway.
        if (!unlockedSomething) showToast(draft.completed ? 'Entry saved' : 'Marked as skipped');
      } catch (err) {
        console.error('[Momentum] failed to save log', err);
        showToast("Couldn't save your entry", 'Retry', () => {
          void saveLog(habitId, draft, date);
        });
      }
    },
    [refresh, showToast, userId, notifyAchievementUnlocks],
  );

  const addHabit = useCallback<AppValue['addHabit']>(
    async (draft) => {
      if (!userId) return;
      await q.createHabit({ userId, ...draft });
      await refresh();
      showToast('Habit created');
    },
    [userId, refresh, showToast],
  );

  const editHabit = useCallback<AppValue['editHabit']>(
    async (habitId, draft) => {
      // Momentum and history are never reset by an edit (data-model.md §6).
      await q.updateHabit(habitId, draft);
      await refresh();
      showToast('Changes saved');
    },
    [refresh, showToast],
  );

  const removeHabit = useCallback<AppValue['removeHabit']>(
    async (habitId) => {
      await q.archiveHabit(habitId);
      await refresh();
      // Soft delete makes undo cheap (user-flows.md §8).
      showToast('Habit removed', 'Undo', () => {
        void (async () => {
          await q.unarchiveHabit(habitId);
          await refresh();
        })();
      });
    },
    [refresh, showToast],
  );

  const chainNamesForHabit = useCallback(
    (habitId: number) => {
      const ids = new Set(data.chainMembers.filter((m) => m.habitId === habitId).map((m) => m.chainId));
      return data.chains.filter((c) => c.id && ids.has(c.id)).map((c) => c.chainName);
    },
    [data.chainMembers, data.chains],
  );

  const value: AppValue = {
    status,
    errorMessage,
    retry,
    userId,
    userName: data.userName,
    habits,
    allLogs: data.logs,
    chains: data.chains,
    chainMembers: data.chainMembers,
    notificationsEnabled: data.notificationsEnabled,
    reminderTime: data.reminderTime,
    settingsId: userId,
    toast,
    showToast,
    dismissToast,
    refresh,
    setCompletion,
    celebration,
    dismissCelebration,
    notifyAchievementUnlocks,
    dismissSuggestion,
    saveLog,
    addHabit,
    editHabit,
    removeHabit,
    chainNamesForHabit,
    refreshHabit,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
