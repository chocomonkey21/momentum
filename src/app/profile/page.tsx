'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings as SettingsIcon, ChevronRight, Lock, Award } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { Screen, ScreenHeader, PageFade } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { ErrorState, Skeleton } from '@/components/ui/States';
import {
  computeAchievements,
  bestStreakEver,
  POINTS_PER_ACHIEVEMENT,
  type Achievement,
  type AchievementType,
} from '@/lib/achievements';
import { totalCompletions, completionRate } from '@/lib/streak';
import { getPomodoroSessions, getUserAchievementState, syncAchievements } from '@/db/queries';
import type { PomodoroSession } from '@/db/schema';
import { cn } from '@/lib/cn';
import { semantic, palette } from '@/theme/theme';

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

  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [unlockedTypes, setUnlockedTypes] = useState<Partial<Record<AchievementType, string>>>({});
  useEffect(() => {
    if (!userId) return;
    void Promise.all([
      getPomodoroSessions(userId),
      syncAchievements(userId),
    ]).then(async ([nextSessions]) => {
      setSessions(nextSessions);
      setUnlockedTypes(await getUserAchievementState(userId));
    });
  }, [userId]);

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
        lifetimeHabitCompletions: stats.completions,
        currentHabitStreak: stats.currentBest,
        completedFocusSessions: (sessions ?? []).filter((s) => s.completed === 1).length,
        unlockedTypes,
      }),
    [stats, sessions, unlockedTypes],
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

        {/* Identity block: amber, the user's initial as a hero glyph. */}
        <section
          className="mb-4 flex items-center gap-5 rounded-[var(--radius-card)] p-5"
          style={{ backgroundColor: palette.amber, color: palette.ink0 }}
        >
          <span
            aria-hidden
            className="font-display-hero inline-flex size-20 shrink-0 items-center justify-center rounded-[var(--radius-block)] bg-black/15 text-[44px]"
          >
            {userName.trim().charAt(0).toUpperCase() || 'M'}
          </span>
          <div className="min-w-0">
            <p className="font-display truncate text-[28px] leading-tight">{userName}</p>
            <p className="font-data mt-2 opacity-70">
              {habits.length} active habit{habits.length === 1 ? '' : 's'}
            </p>
          </div>
        </section>

        <section className="mb-8">
          {status === 'loading' ? (
            <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" />
          ) : (
            <dl className="grid grid-cols-3 gap-3">
              {/* Three hues, three outlined tiles; the amber identity block
                  above is the only solid fill on the screen. */}
              <StatTile label="Best Streak" value={stats.bestStreak} hue={palette.vermillion} />
              <StatTile label="Completions" value={stats.completions} hue={palette.magenta} />
              <StatTile label="Consistency" value={stats.consistency} suffix="%" hue={palette.blue} />
            </dl>
          )}
        </section>

        <section className="mb-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-title2">Achievements</h2>
            <span className="font-data text-label-tertiary">
              {unlockedCount} of {achievements.length} · {unlockedCount * POINTS_PER_ACHIEVEMENT} pts
            </span>
          </div>

          <ul className="divide-y divide-white/[0.07] rounded-[var(--radius-card)] bg-bg-secondary px-5">
            {achievements.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setDetail(a)}
                  aria-label={`${a.name}, ${a.unlocked ? 'unlocked' : 'locked'}. ${a.description}.`}
                  className="flex min-h-[72px] w-full items-center gap-4 py-4 text-left"
                >
                  {/* One hue for every badge: amber disc when unlocked, a dim
                      ring with a lock when not (design-system.md §7). */}
                  <span
                    aria-hidden
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-pill)] border-2"
                    style={
                      a.unlocked
                        ? { backgroundColor: palette.amber, borderColor: palette.amber, color: palette.ink0 }
                        : { borderColor: palette.ink5, color: semantic.labelTertiary }
                    }
                  >
                    {a.unlocked ? <Award size={20} strokeWidth={2} /> : <Lock size={18} strokeWidth={2} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'font-display block truncate text-[18px] leading-tight',
                        a.unlocked ? 'text-label-primary' : 'text-label-secondary',
                      )}
                    >
                      {a.name}
                    </span>
                    <span className="mt-1 block text-footnote text-label-tertiary">{a.description}</span>
                    {!a.unlocked && (
                      <span className="mt-2 block h-1 w-full overflow-hidden rounded-[var(--radius-pill)] bg-ink4">
                        <span
                          className="block h-full rounded-[var(--radius-pill)]"
                          style={{
                            width: `${Math.round(a.progress * 100)}%`,
                            backgroundColor: palette.amber,
                          }}
                        />
                      </span>
                    )}
                  </span>
                  <span
                    className="font-data shrink-0"
                    style={{ color: a.unlocked ? palette.amber : semantic.labelTertiary }}
                  >
                      {a.unlocked ? 'Unlocked' : a.progressLabel}
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
              'flex w-full min-h-[56px] items-center gap-3 rounded-[var(--radius-card)]',
              'bg-bg-secondary px-5 py-4 text-left transition-colors hover:bg-bg-tertiary',
            )}
          >
            <SettingsIcon size={18} className="text-label-tertiary" aria-hidden />
            <span className="flex-1 text-body font-medium">Settings</span>
            <ChevronRight size={18} className="text-label-tertiary" aria-hidden />
          </button>
        </section>
      </PageFade>

      {/* Achievement detail: requirement, current progress, the reward, and
          the exact unlock condition — turning each badge from something you
          look at into something you tap, understand, and work toward. */}
      <Sheet
        open={detail !== null}
        onOpenChange={(o) => !o && setDetail(null)}
        title={detail?.name ?? ''}
        description={detail?.unlocked ? 'Unlocked' : 'Locked'}
      >
        {detail && (
          <div className="flex flex-col gap-5">
            <p className="text-body text-label-secondary">{detail.requirement}.</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[var(--radius-block)] bg-bg-secondary px-4 py-3">
                <p className="font-data text-label-tertiary">Current</p>
                <p className="font-display-hero mt-1 text-[24px] leading-none">
                  {Math.min(detail.current, detail.target)}
                  <span className="font-data ml-1 text-label-tertiary">{detail.unit}</span>
                </p>
              </div>
              <div className="rounded-[var(--radius-block)] bg-bg-secondary px-4 py-3">
                <p className="font-data text-label-tertiary">Reward</p>
                <p className="font-display mt-1 text-[16px] leading-tight">
                  Badge · +{POINTS_PER_ACHIEVEMENT} pts
                </p>
              </div>
            </div>

            {!detail.unlocked && (
              <div>
                <div className="h-3 overflow-hidden rounded-[var(--radius-pill)] bg-bg-tertiary">
                  <div
                    className="h-full rounded-[var(--radius-pill)] bg-app-amber"
                    style={{ width: `${Math.round(detail.progress * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-footnote text-label-secondary">
                  {Math.round(detail.progress * 100)}% of the way there
                </p>
              </div>
            )}

            <div>
              <p className="font-data text-label-tertiary">How to unlock</p>
              <p className="mt-2 text-body">{detail.description}</p>
            </div>
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
  hue,
}: {
  label: string;
  value: number;
  suffix?: string;
  /** Outline + numeral colour. */
  hue: string;
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
    // The stat pattern: numeral, then a tiny uppercase label beneath it.
    <div
      className="flex flex-col items-center rounded-t-[var(--radius-pill)] rounded-b-[var(--radius-block)] border-2 px-3 pb-5 pt-10 text-center"
      style={{ borderColor: hue }}
    >
      <dd className="font-display-hero text-[36px] leading-none" style={{ color: hue }}>
        <motion.span>{shown}</motion.span>
        {suffix}
      </dd>
      <dt className="font-data mt-2 text-label-tertiary">{label}</dt>
    </div>
  );
}
