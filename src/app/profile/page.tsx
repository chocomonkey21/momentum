'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings as SettingsIcon, ChevronRight, Lock, Award } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { Screen, ScreenHeader, PageFade } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { computeAchievements, bestStreakEver, type Achievement } from '@/lib/achievements';
import { totalCompletions, completionRate } from '@/lib/streak';
import { getPomodoroSessions } from '@/db/queries';
import type { PomodoroSession } from '@/db/schema';
import { cn } from '@/lib/cn';
import { semantic, palette } from '@/theme/theme';

const BADGE_HUES = [palette.vermillion, palette.amber, palette.magenta, palette.blue, palette.plum];
const onHue = (h: string) => (h === palette.blue || h === palette.plum ? palette.white : palette.ink0);

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
  useEffect(() => {
    if (!userId) return;
    void getPomodoroSessions(userId).then(setSessions);
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
              {unlockedCount} of {achievements.length}
            </span>
          </div>

          {/* Badges are circles, cycling the five hues — the icon rings from
              the reference. Unlocked = filled disc; locked = a dim outlined
              ring with a lock (design-system.md §7). No tile behind them, so
              the section reads differently from every card list above. */}
          <ul className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4">
            {achievements.map((a, i) => {
              const hue = BADGE_HUES[i % BADGE_HUES.length];
              return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setDetail(a)}
                  aria-label={`${a.name}, ${a.unlocked ? 'unlocked' : 'locked'}. ${a.criteria}.`}
                  className="flex w-full flex-col items-center gap-3 rounded-[var(--radius-card)] px-2 py-2 transition-transform hover:-translate-y-1"
                >
                  <span
                    aria-hidden
                    className="inline-flex size-16 items-center justify-center rounded-[var(--radius-pill)] border-2"
                    style={
                      a.unlocked
                        ? { backgroundColor: hue, borderColor: hue, color: onHue(hue) }
                        : { borderColor: palette.ink5, color: semantic.labelTertiary }
                    }
                  >
                    {a.unlocked ? <Award size={26} strokeWidth={1.75} /> : <Lock size={20} strokeWidth={1.75} />}
                  </span>
                  <span
                    className={cn(
                      'text-center text-footnote font-medium leading-tight',
                      a.unlocked ? 'text-label-primary' : 'text-label-tertiary',
                    )}
                  >
                    {a.name}
                  </span>
                </button>
              </li>
              );
            })}
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
    <div className="rounded-[var(--radius-card)] border-2 px-4 py-5" style={{ borderColor: hue }}>
      <dd className="font-display-hero text-[36px] leading-none" style={{ color: hue }}>
        <motion.span>{shown}</motion.span>
        {suffix}
      </dd>
      <dt className="font-data mt-2 text-label-tertiary">{label}</dt>
    </div>
  );
}
