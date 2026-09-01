'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Habit, type HabitLog, type HabitChain, type ChainHabit } from '@/db/schema';
import * as q from '@/db/queries';
import { seedIfEmpty } from '@/db/seed';
import { todayKey } from '@/lib/dates';
import { currentStreak } from '@/lib/streak';
import { missStreak } from '@/lib/momentum';

/**
 * One state approach for the whole app: React Context + hooks (CLAUDE.md §6).
 * Screens read derived data from here and call actions; components below them
 * stay presentational and never query Dexie themselves.
 *
 * Live reactivity comes from Dexie's useLiveQuery, which is what makes a
 * completion on Home update the chain progress on Manage Chains with no manual
 * refresh (ui-spec.md §9).
 */

export type Status = 'loading' | 'ready' | 'error';

export interface HabitView extends Habit {
  id: number;
  logs: HabitLog[];
  todayLog: HabitLog | undefined;
  streak: number;
  missStreak: number;
  isDueToday: boolean;
}

interface AppValue {
  status: Status;
  errorMessage: string | null;
  retry: () => void;
  userId: number | null;
  userName: string;
  habits: HabitView[];
  allLogs: HabitLog[];
  chains: HabitChain[];
  chainMembers: ChainHabit[];
  notificationsEnabled: boolean;
  reminderTime: string;
  settingsId: number | null;
  /** interaction-spec.md §8 — lightweight, non-blocking confirmation. */
  toast: { message: string; actionLabel?: string; onAction?: () => void } | null;
  showToast: (message: string, actionLabel?: string, onAction?: () => void) => void;
  dismissToast: () => void;
  setCompletion: (habitId: number, completed: boolean) => Promise<void>;
  refreshHabit: (habitId: number) => Promise<void>;
}

const AppContext = createContext<AppValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState<AppValue['toast']>(null);

  // Boot: seed on first run, then run the lazy end-of-day evaluation
  // (data-model.md §4.4) before anything renders real numbers.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStatus('loading');
        setErrorMessage(null);
        await seedIfEmpty();
        const id = await q.ensureUser();
        await q.evaluateAllHabits(id);
        await q.getSettings();
        if (cancelled) return;
        setUserId(id);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        console.error('[Momentum] boot failed', err);
        setErrorMessage(
          "We couldn't open your local habit database. Your data is still saved in this browser.",
        );
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const user = useLiveQuery(() => (userId ? db.users.get(userId) : undefined), [userId]);
  const rawHabits = useLiveQuery(
    () => (userId ? q.getActiveHabits(userId) : Promise.resolve([])),
    [userId],
    [] as Habit[],
  );
  const habitIds = useMemo(
    () => (rawHabits ?? []).map((h) => h.id).filter((x): x is number => typeof x === 'number'),
    [rawHabits],
  );
  const allLogs = useLiveQuery(() => q.getAllLogs(habitIds), [habitIds.join(',')], [] as HabitLog[]);
  const chains = useLiveQuery(
    () => (userId ? q.getChains(userId) : Promise.resolve([])),
    [userId],
    [] as HabitChain[],
  );
  const chainMembers = useLiveQuery(() => q.getAllChainMembers(), [], [] as ChainHabit[]);
  const settings = useLiveQuery(() => q.getSettings(), []);

  const today = todayKey();

  const habits: HabitView[] = useMemo(() => {
    const byHabit = new Map<number, HabitLog[]>();
    for (const log of allLogs ?? []) {
      const list = byHabit.get(log.habitId);
      if (list) list.push(log);
      else byHabit.set(log.habitId, [log]);
    }
    return (rawHabits ?? [])
      .filter((h): h is Habit & { id: number } => typeof h.id === 'number')
      .map((h) => {
        const logs = (byHabit.get(h.id) ?? []).sort((a, b) => a.date.localeCompare(b.date));
        return {
          ...h,
          logs,
          todayLog: logs.find((l) => l.date === today),
          streak: currentStreak(logs, today),
          missStreak: missStreak(logs, today),
          isDueToday: q.isDueOn(h, today),
        };
      });
  }, [rawHabits, allLogs, today]);

  const showToast = useCallback(
    (message: string, actionLabel?: string, onAction?: () => void) => {
      // Interruptible: a new toast replaces an in-flight one (interaction-spec.md §8).
      setToast({ message, actionLabel, onAction });
    },
    [],
  );
  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const refreshHabit = useCallback(async (habitId: number) => {
    await q.recomputeMomentum(habitId);
  }, []);

  /**
   * user-flows.md §5 / §6. The optimistic UI lives in the component (the toggle
   * fills on press-down); this is the write path behind it.
   */
  const setCompletion = useCallback(
    async (habitId: number, completed: boolean) => {
      try {
        await q.upsertLog({ habitId, date: todayKey(), completed: completed ? 1 : 0 });
        await q.recomputeMomentum(habitId);
      } catch (err) {
        console.error('[Momentum] failed to save completion', err);
        showToast("Couldn't save that — tap to retry", 'Retry', () => {
          void setCompletion(habitId, completed);
        });
      }
    },
    [showToast],
  );

  const value: AppValue = {
    status,
    errorMessage,
    retry,
    userId,
    userName: user?.name ?? 'there',
    habits,
    allLogs: allLogs ?? [],
    chains: chains ?? [],
    chainMembers: chainMembers ?? [],
    notificationsEnabled: settings?.notificationsEnabled === 1,
    reminderTime: settings?.reminderTime ?? '08:00',
    settingsId: settings?.id ?? null,
    toast,
    showToast,
    dismissToast,
    setCompletion,
    refreshHabit,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
