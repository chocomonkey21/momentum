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
import { chartHex, semantic } from '@/theme/theme';
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
                  // Chain-complete celebration: a light tint of color.positive
                  // that fades back (interaction-spec.md §11).
                  animate={
                    complete && !reduce
                      ? { backgroundColor: ['rgba(48,209,88,0.18)', 'rgba(28,28,30,1)'] }
                      : {}
                  }
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className={cn(
                    'group rounded-[var(--radius-card)] bg-bg-secondary p-5 transition-colors',
                    complete && 'ring-1 ring-positive/40',
                  )}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setBuilderFor(chain.id ?? null)}
                      className="min-w-0 flex-1 text-left"
                      aria-label={`Edit chain ${chain.chainName}, ${done} of ${total} complete today`}
                    >
                      <p className="truncate text-headline font-semibold">{chain.chainName}</p>
                      <p className="mt-0.5 text-footnote text-label-secondary">
                        {total === 0
                          ? 'No habits in this chain yet'
                          : complete
                            ? 'Complete for today'
                            : `${done} of ${total} complete today`}
                      </p>
                    </button>

                    <div className="flex items-center gap-2">
                      {complete && (
                        <span
                          className="inline-flex size-7 items-center justify-center rounded-full"
                          style={{ backgroundColor: semantic.positive }}
                          aria-hidden
                        >
                          <Check size={16} className="text-black" />
                        </span>
                      )}
                      {/* Chain deletion needs NO confirmation — it removes only
                          the grouping, not any habit or log (user-flows.md §8). */}
                      <IconButton
                        label={`Delete chain ${chain.chainName}`}
                        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
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
                              'inline-flex items-center gap-1.5 rounded-[var(--radius-block)] px-3 py-1.5',
                              'text-footnote transition-colors',
                              isDone ? 'text-black' : 'bg-bg-tertiary text-label-primary',
                            )}
                            style={
                              isDone ? { backgroundColor: chartHex(habit.chartColor) } : undefined
                            }
                          >
                            {isDone && <Check size={12} aria-hidden />}
                            {habit.name}
                          </span>
                          {i < members.length - 1 && (
                            <ArrowRight size={14} className="text-label-secondary" aria-hidden />
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
            <Button variant="outlined" fullWidth onClick={() => setBuilderFor('new')}>
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
