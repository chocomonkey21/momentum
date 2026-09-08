-- "Not now" on the adaptive-difficulty suggestion card needs to mean
-- something across sessions, not just for the current page load. A date
-- column is enough: while today <= suggestion_dismissed_until, the
-- suggestion stays hidden even though the underlying miss streak still
-- qualifies it. Editing the habit through the normal form never touches
-- this column (updateHabit only patches fields it's explicitly given).
alter table public.habits
  add column if not exists suggestion_dismissed_until date;
