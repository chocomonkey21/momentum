'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { Settings as SettingsIcon, ChevronRight, Lock, Award } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { Screen, ScreenHeader, PageFade } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { computeAchievements, bestStreakEver, type Achievement } from '@/lib/achievements';
import { totalCompletions, completionRate } from '@/lib/streak';
import { getPomodoroSessions } from '@/db/queries';
import { cn } from '@/lib/cn';
import { semantic } from '@/theme/theme';

/**
 * Profile (ui-spec.md §13) — identity, lifetime stats, achievements, and the
 * entry point to Settings.
 *
 * The lifetime stat row is computed from the SAME logs Statistics reads, never
 * a separately stored number, so the two screens can't disagree (§13 assumption
 * resolving an audit finding).
 */
export default function ProfilePage() {
  const router = useRouter();
  const { status, errorMessage, retry, habits, allLogs, userName, userId } = useApp();
  const [detail, setDetail] = useState<Achievement | null>(null);

  const sessions = useLiveQuery(
    () => (userId ? getPomodoroSessions(userId) : Promise.resolve([])),
    [userId],
    [],
  );

  const stats = useMemo(() => {
    const bestStreak = habits.reduce((m, h) => Math.max(m, bestStreakEver(h.logs)), 0);
    const currentBest = habits.reduce((m, h) => Math.max(m, h.streak), 0);
    return {
      completions: totalCompletions(allLogs),
      consistency: completionRate(allLogs),
      bestStreak,
      currentBest,
      bestMomentum: habits.reduce((m, h) => Math.max(m, h.momentumScore), 0),
    };
  }, [habits, allLogs]);

  const achievements = useMemo(
    () =>
      computeAchievements({
        logs: allLogs,
        bestStreak: stats.bestStreak,
        habitCount: habits.length,
        bestMomentum: stats.bestMomentum,
        focusSessions: (sessions ?? []).filter((s) => s.completed === 1).length,
      }),
    [allLogs, stats, habits.length, sessions],
  );

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  if (status === 'error') {
    return (
      <Screen>
        <ScreenHeader title="Profile" />
        <ErrorState message={errorMessage ?? 'Something went wrong.'} onRetry={retry} />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageFade>
        <ScreenHeader title="Profile" />

        <section className="mb-8 flex items-center gap-4">
          <span
            aria-hidden
            className="inline-flex size-16 shrink-0 items-center justify-center rounded-[22px] font-display text-large-title text-white"
            style={{ backgroundColor: semantic.tint }}
          >
            {userName.trim().charAt(0).toUpperCase() || 'M'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-title2 font-bold">{userName}</p>
            <p className="text-subheadline text-label-secondary">
              {habits.length} active habit{habits.length === 1 ? '' : 's'}
            </p>
          </div>
        </section>

        <section className="mb-8">
          {status === 'loading' ? (
            <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" />
          ) : (
            <dl className="grid grid-cols-3 gap-3">
              <StatTile label="Best streak" value={stats.bestStreak} suffix=" days" />
              <StatTile label="Completions" value={stats.completions} />
              <StatTile label="Consistency" value={stats.consistency} suffix="%" />
            </dl>
          )}
        </section>

        <section className="mb-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-title2 font-bold">Achievements</h2>
            <span className="text-footnote text-label-secondary">
              {unlockedCount} of {achievements.length}
            </span>
          </div>

          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {achievements.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setDetail(a)}
                  aria-label={`${a.name}, ${a.unlocked ? 'unlocked' : 'locked'}. ${a.criteria}.`}
                  className={cn(
                    'flex w-full flex-col items-center gap-2 rounded-[var(--radius-card)]',
                    'bg-bg-secondary px-2 py-4 transition-colors hover:bg-bg-tertiary',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'inline-flex size-11 items-center justify-center rounded-full',
                      // Locked = grey and low opacity, explicitly defined
                      // (design-system.md §7).
                      a.unlocked ? 'bg-warning/20' : 'bg-bg-tertiary opacity-40',
                    )}
                  >
                    {a.unlocked ? (
                      <Award size={22} className="text-warning" />
                    ) : (
                      <Lock size={18} className="text-label-secondary" />
                    )}
                  </span>
                  <span
                    className={cn(
                      'text-center text-caption1 leading-tight',
                      a.unlocked ? 'text-label-primary' : 'text-label-secondary',
                    )}
                  >
                    {a.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <button
            type="button"
            onClick={() => router.push('/settings')}
            className={cn(
              'flex w-full min-h-[44px] items-center gap-3 rounded-[var(--radius-card)]',
              'bg-bg-secondary px-5 py-4 text-left transition-colors hover:bg-bg-tertiary',
            )}
          >
            <SettingsIcon size={20} className="text-label-secondary" aria-hidden />
            <span className="flex-1 text-body">Settings</span>
            <ChevronRight size={18} className="text-label-secondary" aria-hidden />
          </button>
        </section>
      </PageFade>

      <Sheet
        open={detail !== null}
        onOpenChange={(o) => !o && setDetail(null)}
        title={detail?.name ?? ''}
        description={detail?.unlocked ? 'Unlocked' : 'Locked'}
      >
        {detail && (
          <div className="flex flex-col gap-4">
            <p className="text-body">{detail.criteria}</p>
            {!detail.unlocked && (
              <div>
                <div className="h-2 overflow-hidden rounded-full bg-bg-tertiary">
                  <div
                    className="h-full rounded-full bg-tint"
                    style={{ width: `${Math.round(detail.progress * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-footnote text-label-secondary">
                  {Math.round(detail.progress * 100)}% of the way there
                </p>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </Screen>
  );
}

/** Counts up from 0 on first mount only (ui-spec.md §13), never on revisit. */
function StatTile({
  label,
  value,
  suffix = '',
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const duration = 400;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(value * t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduce]);

  return (
    <div className="rounded-[var(--radius-card)] bg-bg-secondary px-3 py-4 text-center">
      <dd className="text-title2 font-bold tabular-nums">
        <motion.span>{shown}</motion.span>
        {suffix}
      </dd>
      <dt className="mt-1 text-caption1 uppercase tracking-wide text-label-secondary">{label}</dt>
    </div>
  );
}
