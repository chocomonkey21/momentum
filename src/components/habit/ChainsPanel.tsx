'use client';

import { useMemo, useState } from 'react';
import { Link2, Plus, ArrowRight, Check, Trash2 } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { ChainBuilder } from '@/components/habit/ChainBuilder';
import { deleteChain, createChain, saveChainMembers, renameChain } from '@/db/queries';
import { cn } from '@/lib/cn';
import { spring } from '@/theme/theme';
import { chartHex, onChartHex, semantic, palette } from '@/theme/theme';
import { todayKey } from '@/lib/dates';

/**
 * Chains, extracted from the old standalone /chains screen so it can live as a
 * view inside the Habits section (ui-spec.md §9's content, re-hosted).
 *
 * Progress stays a COMPUTED read (data-model.md §5) — completing a member habit
 * anywhere else updates this immediately via the live query in AppContext.
 */
export function ChainsPanel({
  openBuilderSignal,
  onBuilderHandled,
}: {
  /** Incremented by the host screen's "+" action to open the builder. */
  openBuilderSignal?: number;
  onBuilderHandled?: () => void;
}) {
  const { status, habits, chains, chainMembers, userId, showToast } = useApp();
  const reduce = useReducedMotion();

  const [builderFor, setBuilderFor] = useState<number | 'new' | null>(null);
  const [lastSignal, setLastSignal] = useState(openBuilderSignal ?? 0);

  // Host screen asked us to open the builder.
  if (openBuilderSignal !== undefined && openBuilderSignal !== lastSignal) {
    setLastSignal(openBuilderSignal);
    setBuilderFor('new');
  }

  const today = todayKey();

  const chainViews = useMemo(() => {
    return chains.map((chain) => {
      const members = chainMembers
        .filter((m) => m.chainId === chain.id)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((m) => habits.find((h) => h.id === m.habitId))
        .filter((h): h is NonNullable<typeof h> => Boolean(h));
      const done = members.filter((h) =>
        h.logs.some((l) => l.date === today && l.completed === 1),
      ).length;
      return {
        chain,
        members,
        done,
        total: members.length,
        complete: members.length > 0 && done === members.length,
      };
    });
  }, [chains, chainMembers, habits, today]);

  const editing = builderFor === 'new' ? null : chainViews.find((c) => c.chain.id === builderFor);

  function closeBuilder() {
    setBuilderFor(null);
    onBuilderHandled?.();
  }

  return (
    <>
      {status === 'loading' ? (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : chainViews.length === 0 ? (
        <EmptyState
          icon={Link2}
          message="No chains yet. Group habits you always do together and track them as one."
          actionLabel="Build your first chain"
          onAction={() => setBuilderFor('new')}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {chainViews.map(({ chain, members, done, total, complete }) => (
              <li key={chain.id}>
                <motion.div
                  // Chain-complete celebration (interaction-spec.md §11): the
                  // whole card becomes a solid block of colour.positive, on the
                  // bouncy spring — one of the few earned bounces in the app.
                  animate={{ scale: complete && !reduce ? [0.97, 1] : 1 }}
                  transition={reduce ? { duration: 0.15 } : spring.bouncy}
                  // Complete = outlined in green with a filled check ring;
                  // in progress = neutral surface. Same rhythm as habit cards.
                  className="group rounded-[var(--radius-card)] border-2 p-5 transition-colors"
                  style={{
                    backgroundColor: complete ? palette.ink0 : semantic.bgSecondary,
                    borderColor: complete ? semantic.positive : 'transparent',
                    color: palette.white,
                  }}
                >
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setBuilderFor(chain.id ?? null)}
                      className="min-w-0 flex-1 text-left"
                      aria-label={`Edit chain ${chain.chainName}, ${done} of ${total} complete today`}
                    >
                      <p className="font-display truncate text-[22px] leading-tight">{chain.chainName}</p>
                      {/* Stat pattern: done / total, then the label. */}
                      <div className="mt-3 flex items-baseline gap-1">
                        <span
                          className="font-display-hero text-[40px] leading-none"
                          style={{ color: complete ? semantic.positive : palette.white }}
                        >
                          {done}
                        </span>
                        <span className="font-display-hero text-[20px] leading-none text-label-tertiary">
                          /{total}
                        </span>
                      </div>
                      <p className="font-data mt-2 text-label-tertiary">
                        {total === 0 ? 'No habits yet' : complete ? 'Complete for today' : 'Complete today'}
                      </p>
                    </button>

                    <div className="flex items-center gap-2">
                      {complete && (
                        <span
                          className="inline-flex size-9 items-center justify-center rounded-[var(--radius-pill)] text-black"
                          style={{ backgroundColor: semantic.positive }}
                          aria-hidden
                        >
                          <Check size={18} strokeWidth={3} />
                        </span>
                      )}
                      {/* Chain deletion needs NO confirmation — it removes only
                          the grouping, not any habit or log (user-flows.md §8). */}
                      <IconButton
                        label={`Delete chain ${chain.chainName}`}
                        className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                        onClick={async () => {
                          if (!chain.id) return;
                          const name = chain.chainName;
                          const snapshot = members.map((m) => m.id);
                          await deleteChain(chain.id);
                          showToast(`${name} removed`, 'Undo', async () => {
                            if (userId) await createChain(userId, name, snapshot);
                          });
                        }}
                      >
                        <Trash2 size={18} aria-hidden />
                      </IconButton>
                    </div>
                  </div>

                  {/* Member sequence, left-to-right with arrows. */}
                  <ol className="flex flex-wrap items-center gap-2">
                    {members.map((habit, i) => {
                      const isDone = habit.logs.some(
                        (l) => l.date === today && l.completed === 1,
                      );
                      return (
                        <li key={habit.id} className="flex items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex min-h-[36px] items-center gap-2 rounded-[var(--radius-pill)] border-2 px-3',
                              'text-footnote font-medium transition-colors',
                            )}
                            // Done members are filled pills in their hue; the
                            // rest are outlined rings — the reference's rhythm.
                            style={
                              isDone
                                ? {
                                    backgroundColor: chartHex(habit.chartColor),
                                    borderColor: chartHex(habit.chartColor),
                                    color: onChartHex(habit.chartColor),
                                  }
                                : {
                                    backgroundColor: 'transparent',
                                    borderColor: palette.ink5,
                                    color: palette.white,
                                  }
                            }
                          >
                            {isDone && <Check size={12} strokeWidth={3} aria-hidden />}
                            {habit.name}
                          </span>
                          {i < members.length - 1 && (
                            <ArrowRight size={14} className="text-label-tertiary" aria-hidden />
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </motion.div>
              </li>
            ))}
          </ul>

          <div className="mt-5">
            <Button variant="secondary" fullWidth onClick={() => setBuilderFor('new')}>
              <Plus size={18} aria-hidden />
              New Chain
            </Button>
          </div>
        </>
      )}

      <ChainBuilder
        open={builderFor !== null}
        onOpenChange={(o) => !o && closeBuilder()}
        habits={habits}
        initialName={editing?.chain.chainName ?? ''}
        initialHabitIds={editing?.members.map((m) => m.id) ?? []}
        onSave={async (name, habitIds) => {
          if (builderFor === 'new') {
            if (!userId) return;
            await createChain(userId, name, habitIds);
            showToast('Chain created');
          } else if (typeof builderFor === 'number') {
            await renameChain(builderFor, name);
            await saveChainMembers(builderFor, habitIds);
            showToast('Chain saved');
          }
          closeBuilder();
        }}
      />
    </>
  );
}
