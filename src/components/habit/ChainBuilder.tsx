'use client';

import { useEffect, useState } from 'react';
import { Reorder, useDragControls, useReducedMotion } from 'framer-motion';
import { GripVertical, X, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button, IconButton } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { cn } from '@/lib/cn';
import { chartHex } from '@/theme/theme';
import type { HabitView } from '@/context/AppContext';

/**
 * Chain builder (ui-spec.md §9): name, add-habit picker, reorderable member
 * list, save.
 *
 * Reordering uses Framer Motion's Reorder, which handles mouse and touch
 * identically (interaction-spec.md §14). Crucially it is NOT the only way to
 * reorder — each row also carries "Move up" / "Move down" buttons, because a
 * drag gesture alone is unreachable by keyboard and screen reader
 * (ui-spec.md §9 focus requirement).
 */
export function ChainBuilder({
  open,
  onOpenChange,
  habits,
  initialName,
  initialHabitIds,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habits: HabitView[];
  initialName: string;
  initialHabitIds: number[];
  onSave: (name: string, habitIds: number[]) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [selected, setSelected] = useState<number[]>(initialHabitIds);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setSelected(initialHabitIds);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const available = habits.filter((h) => !selected.includes(h.id));
  const canSave = name.trim().length > 0 && selected.length >= 1;

  function move(index: number, delta: number) {
    const next = [...selected];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSelected(next);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={initialName ? 'Edit Chain' : 'New Chain'}
      description="Habits you always do together, tracked as one unit."
    >
      <div className="flex flex-col gap-6">
        <div>
          <label htmlFor="chain-name" className="font-data mb-2 block text-label-tertiary">
            Chain Name
          </label>
          <input
            id="chain-name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="Morning Routine"
            className={cn(
              'w-full rounded-[var(--radius-block)] bg-bg-tertiary px-4 py-4',
              'font-display text-[22px] text-label-primary placeholder:text-label-tertiary',
              'border-2 border-transparent transition-colors focus:border-tint',
            )}
          />
        </div>

        <div>
          <h3 className="font-data mb-3 text-label-tertiary">In this chain · {selected.length}</h3>

          {selected.length === 0 ? (
            <p className="rounded-[var(--radius-block)] bg-bg-secondary px-4 py-5 text-footnote text-label-secondary">
              Add at least one habit below.
            </p>
          ) : (
            <Reorder.Group axis="y" values={selected} onReorder={setSelected} className="flex flex-col gap-2">
              {selected.map((habitId, index) => {
                const habit = habits.find((h) => h.id === habitId);
                if (!habit) return null;
                return (
                  <ChainRow
                    key={habitId}
                    habitId={habitId}
                    name={habit.name}
                    color={chartHex(habit.chartColor)}
                    index={index}
                    total={selected.length}
                    onMove={move}
                    onRemove={() => setSelected(selected.filter((id) => id !== habitId))}
                  />
                );
              })}
            </Reorder.Group>
          )}

          {selected.length === 1 && (
            // Soft nudge, not a block — a one-habit chain is allowed
            // (user-flows.md §13).
            <p className="mt-2 text-footnote text-label-secondary">
              Chains work best with two or more habits.
            </p>
          )}
        </div>

        {available.length > 0 && (
          <div>
            <h3 className="font-data mb-3 text-label-tertiary">Add a habit</h3>
            <div className="flex flex-wrap gap-2">
              {available.map((h) => (
                <Chip key={h.id} selected={false} onSelect={() => setSelected([...selected, h.id])}>
                  <Plus size={14} aria-hidden />
                  {h.name}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <Button
          fullWidth
          disabled={!canSave}
          loading={saving}
          onClick={async () => {
            setSaving(true);
            await onSave(name.trim(), selected);
          }}
        >
          Save Chain
        </Button>
      </div>
    </Sheet>
  );
}

function ChainRow({
  habitId,
  name,
  color,
  index,
  total,
  onMove,
  onRemove,
}: {
  habitId: number;
  name: string;
  color: string;
  index: number;
  total: number;
  onMove: (index: number, delta: number) => void;
  onRemove: () => void;
}) {
  const controls = useDragControls();
  const reduce = useReducedMotion();

  return (
    <Reorder.Item
      value={habitId}
      dragListener={false}
      dragControls={controls}
      // Picked-up chip lifts and casts a shadow — the visual stand-in for the
      // haptic the native build would have used (interaction-spec.md §14).
      whileDrag={reduce ? undefined : { scale: 1.05, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
      className="flex items-center gap-3 rounded-[var(--radius-block)] bg-bg-tertiary p-2 pl-2"
    >
      <span
        aria-hidden
        className="size-8 shrink-0 rounded-[var(--radius-pill)]"
        style={{ backgroundColor: color }}
      />
      <span className="min-w-0 flex-1 truncate text-body font-medium">{name}</span>

      <IconButton
        label={`Move ${name} up`}
        disabled={index === 0}
        onClick={() => onMove(index, -1)}
        className="size-9"
      >
        <ChevronUp size={16} aria-hidden />
      </IconButton>
      <IconButton
        label={`Move ${name} down`}
        disabled={index === total - 1}
        onClick={() => onMove(index, 1)}
        className="size-9"
      >
        <ChevronDown size={16} aria-hidden />
      </IconButton>
      <IconButton label={`Remove ${name} from chain`} onClick={onRemove} className="size-9">
        <X size={16} aria-hidden />
      </IconButton>

      <span
        // Drag handle: pointer-only, hence aria-hidden — the buttons above are
        // the accessible path.
        aria-hidden
        onPointerDown={(e) => controls.start(e)}
        className="cursor-grab touch-none p-2 text-label-secondary hover:text-label-primary active:cursor-grabbing"
      >
        <GripVertical size={18} />
      </span>
    </Reorder.Item>
  );
}
