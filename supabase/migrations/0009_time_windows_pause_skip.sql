-- Time-constrained habits move from a single deadline to an optional window
-- (window_start .. time_constraint, the existing deadline column now reads
-- as the window's END). Both null: flexible, log anytime. Only end set:
-- old deadline-only behaviour. Both set: a true start/end window.
alter table public.habits
  add column if not exists window_start text
  check (window_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- Pausing a habit freezes its momentum: no new backfilled misses, no
-- decay, no "due today" — until it's resumed.
alter table public.habits
  add column if not exists paused_at timestamptz;

-- A log row now distinguishes an intentional, user-chosen skip from an
-- ordinary miss. Skips don't break a streak and don't count toward the
-- 30-day consistency rate; ordinary misses (including ones the nightly
-- backfill writes for a day nobody touched) still do both.
alter table public.habit_logs
  add column if not exists skipped boolean not null default false;

-- Whether THIS completion landed inside its habit's time window at the
-- moment it was logged. Null when the habit has no window, or when the
-- entry was backfilled for a past day (there's no real completion instant
-- to judge against, so it's left unknown rather than guessed).
alter table public.habit_logs
  add column if not exists on_time boolean;
