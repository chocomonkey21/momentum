-- ============================================================================
-- Momentum — initial schema
--
-- Every entity from data-model.md, as Postgres tables instead of Dexie stores.
-- Field names, types and relationships are unchanged; only the storage layer
-- differs. Run this once in the Supabase SQL editor.
--
-- The one structural change from data-model.md: the `users` table is no longer
-- "exactly one implicit local row" (§0). It is now a PROFILE row linked 1:1 to
-- Supabase's built-in auth.users.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Profiles  (data-model.md §1, re-scoped for real accounts)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  -- 1:1 with auth.users. Deleting the auth user cascades the whole account.
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text        not null default 'You',
  -- §1 notes username becomes required for Friends lookup. Unique but nullable
  -- so signup can complete before a handle is chosen.
  username    text        unique,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Habits  (data-model.md §2)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.frequency as enum ('daily', 'weekly', 'custom');
exception when duplicate_object then null; end $$;

create table if not exists public.habits (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references public.users (id) on delete cascade,
  -- §2 validation: 1–60 chars after trim, rejected empty.
  name             text not null check (length(btrim(name)) between 1 and 60),
  frequency        public.frequency not null default 'daily',
  -- 1 = Easy, 2 = Medium, 3 = Hard.
  difficulty_level smallint not null default 2 check (difficulty_level between 1 and 3),
  -- 0–100. New habits start at the midpoint.
  momentum_score   real not null default 50 check (momentum_score between 0 and 100),
  -- 'HH:mm' local. Postgres `time` would coerce to a zoned concept on read;
  -- data-model.md §4.3 compares it as a local wall-clock string, so it stays text.
  time_constraint  text check (time_constraint ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  category_tag     text,
  chart_color      text not null default 'amber',
  created_at       timestamptz not null default now(),
  -- §6: soft delete. Never removes HabitLog history.
  archived_at      timestamptz
);

-- §9: "active habits for this user" is the query on nearly every screen.
create index if not exists habits_user_idx on public.habits (user_id);
create index if not exists habits_user_active_idx on public.habits (user_id, archived_at);

-- ---------------------------------------------------------------------------
-- 3. HabitLog  (data-model.md §3)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.context_tag as enum ('home', 'work', 'gym', 'other');
exception when duplicate_object then null; end $$;

create table if not exists public.habit_logs (
  id         bigint generated always as identity primary key,
  habit_id   bigint not null references public.habits (id) on delete cascade,
  -- The day this entry is FOR, in the user's local time (§0). A bare `date`,
  -- never a timestamp, so it can't drift across a timezone boundary.
  date       date not null,
  completed  boolean not null,
  mood_tag   smallint check (mood_tag between 1 and 5),
  context_tag public.context_tag,
  -- §3: max 280 chars — a note, not a journal entry.
  notes      text check (length(notes) <= 280),
  -- Actual timestamp of the log action, used to enforce time constraints.
  logged_at  timestamptz not null default now(),

  -- §3: one log per habit per day. Dexie could not enforce this and the app
  -- had to check by hand; Postgres enforces it for real.
  constraint habit_logs_one_per_day unique (habit_id, date)
);

create index if not exists habit_logs_habit_idx on public.habit_logs (habit_id);
create index if not exists habit_logs_habit_date_idx on public.habit_logs (habit_id, date desc);

-- ---------------------------------------------------------------------------
-- 4. HabitChain / ChainHabit  (data-model.md §5)
-- ---------------------------------------------------------------------------
create table if not exists public.habit_chains (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.users (id) on delete cascade,
  chain_name text not null check (length(btrim(chain_name)) between 1 and 40),
  created_at timestamptz not null default now()
);

create index if not exists habit_chains_user_idx on public.habit_chains (user_id);

create table if not exists public.chain_habits (
  chain_id    bigint not null references public.habit_chains (id) on delete cascade,
  -- §5: removing a habit from a chain deletes only this row; the habit and its
  -- logs are untouched.
  habit_id    bigint not null references public.habits (id) on delete cascade,
  order_index integer not null default 0,
  primary key (chain_id, habit_id)
);

-- Both directions are queried: chain -> its habits, habit -> its chains.
create index if not exists chain_habits_chain_idx on public.chain_habits (chain_id);
create index if not exists chain_habits_habit_idx on public.chain_habits (habit_id);

-- ---------------------------------------------------------------------------
-- 5. PomodoroSession  (data-model.md §7)
-- ---------------------------------------------------------------------------
create table if not exists public.pomodoro_sessions (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references public.users (id) on delete cascade,
  -- Optional link. §7: a completed session does NOT create a HabitLog.
  habit_id         bigint references public.habits (id) on delete set null,
  start_time       timestamptz not null,
  end_time         timestamptz,
  duration_minutes integer not null check (duration_minutes > 0),
  completed        boolean not null default false
);

create index if not exists pomodoro_user_idx on public.pomodoro_sessions (user_id);
create index if not exists pomodoro_habit_idx on public.pomodoro_sessions (habit_id);

-- ---------------------------------------------------------------------------
-- 6. Friendship / Challenge / ChallengeParticipant  (data-model.md §8)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.friendship_status as enum ('pending', 'accepted');
exception when duplicate_object then null; end $$;

create table if not exists public.friendships (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.users (id) on delete cascade,
  friend_user_id uuid not null references public.users (id) on delete cascade,
  status         public.friendship_status not null default 'pending',
  created_at     timestamptz not null default now(),
  constraint friendships_no_self check (user_id <> friend_user_id),
  constraint friendships_unique_pair unique (user_id, friend_user_id)
);

create index if not exists friendships_user_idx on public.friendships (user_id);
create index if not exists friendships_friend_idx on public.friendships (friend_user_id);

create table if not exists public.challenges (
  id              bigint generated always as identity primary key,
  creator_user_id uuid not null references public.users (id) on delete cascade,
  challenge_name  text not null,
  -- §8: challenges are aggregate (e.g. total momentum gained), never tied to a
  -- single habit, so there is deliberately no habit_id here.
  goal_metric     text not null,
  start_date      date not null,
  end_date        date not null,
  constraint challenges_dates check (end_date >= start_date)
);

create index if not exists challenges_creator_idx on public.challenges (creator_user_id);

create table if not exists public.challenge_participants (
  challenge_id bigint not null references public.challenges (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  progress     integer not null default 0,
  primary key (challenge_id, user_id)
);

create index if not exists challenge_participants_user_idx
  on public.challenge_participants (user_id);

-- ---------------------------------------------------------------------------
-- 7. Settings (app-local preferences; not in data-model.md, added by the build)
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  user_id               uuid primary key references public.users (id) on delete cascade,
  notifications_enabled boolean not null default false,
  reminder_time         text not null default '08:00'
    check (reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

-- ---------------------------------------------------------------------------
-- 8. Profile bootstrap
--
-- Creates the profile + settings rows the moment an auth user is created, so
-- the client never has to race a "does my profile exist yet?" check on first
-- login. SECURITY DEFINER because the trigger runs before any session exists.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 9. Row Level Security
--
-- Enabled on EVERY table — nothing is left open by default. The base rule is
-- "you can only touch rows that are yours", expressed as user_id = auth.uid().
--
-- Tables that don't carry user_id directly (habit_logs, chain_habits) are
-- scoped by joining back to the owning habit/chain, so a user cannot read or
-- write a log belonging to someone else's habit even by guessing its id.
-- ============================================================================

alter table public.users                  enable row level security;
alter table public.habits                 enable row level security;
alter table public.habit_logs             enable row level security;
alter table public.habit_chains           enable row level security;
alter table public.chain_habits           enable row level security;
alter table public.pomodoro_sessions      enable row level security;
alter table public.friendships            enable row level security;
alter table public.challenges             enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.settings               enable row level security;

-- --- users -----------------------------------------------------------------
drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
  for select using (id = auth.uid());

drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users
  for insert with check (id = auth.uid());

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- --- habits ----------------------------------------------------------------
drop policy if exists habits_all_own on public.habits;
create policy habits_all_own on public.habits
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- --- habit_logs (scoped through the owning habit) ---------------------------
drop policy if exists habit_logs_all_own on public.habit_logs;
create policy habit_logs_all_own on public.habit_logs
  for all
  using (
    exists (
      select 1 from public.habits h
      where h.id = habit_logs.habit_id and h.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.habits h
      where h.id = habit_logs.habit_id and h.user_id = auth.uid()
    )
  );

-- --- habit_chains ----------------------------------------------------------
drop policy if exists habit_chains_all_own on public.habit_chains;
create policy habit_chains_all_own on public.habit_chains
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- --- chain_habits (scoped through the owning chain) -------------------------
drop policy if exists chain_habits_all_own on public.chain_habits;
create policy chain_habits_all_own on public.chain_habits
  for all
  using (
    exists (
      select 1 from public.habit_chains c
      where c.id = chain_habits.chain_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.habit_chains c
      where c.id = chain_habits.chain_id and c.user_id = auth.uid()
    )
  );

-- --- pomodoro_sessions -----------------------------------------------------
drop policy if exists pomodoro_all_own on public.pomodoro_sessions;
create policy pomodoro_all_own on public.pomodoro_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- --- settings --------------------------------------------------------------
drop policy if exists settings_all_own on public.settings;
create policy settings_all_own on public.settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- --- friendships -----------------------------------------------------------
-- Readable from either side so an incoming request is visible to its recipient;
-- writable only by the row's owner.
drop policy if exists friendships_select_involving_me on public.friendships;
create policy friendships_select_involving_me on public.friendships
  for select using (user_id = auth.uid() or friend_user_id = auth.uid());

drop policy if exists friendships_write_own on public.friendships;
create policy friendships_write_own on public.friendships
  for insert with check (user_id = auth.uid());

drop policy if exists friendships_update_involving_me on public.friendships;
create policy friendships_update_involving_me on public.friendships
  for update using (user_id = auth.uid() or friend_user_id = auth.uid());

drop policy if exists friendships_delete_own on public.friendships;
create policy friendships_delete_own on public.friendships
  for delete using (user_id = auth.uid());

-- --- challenges ------------------------------------------------------------
-- Visible to the creator and to anyone taking part.
drop policy if exists challenges_select_mine on public.challenges;
create policy challenges_select_mine on public.challenges
  for select using (
    creator_user_id = auth.uid()
    or exists (
      select 1 from public.challenge_participants p
      where p.challenge_id = challenges.id and p.user_id = auth.uid()
    )
  );

drop policy if exists challenges_write_own on public.challenges;
create policy challenges_write_own on public.challenges
  for insert with check (creator_user_id = auth.uid());

drop policy if exists challenges_update_own on public.challenges;
create policy challenges_update_own on public.challenges
  for update using (creator_user_id = auth.uid()) with check (creator_user_id = auth.uid());

drop policy if exists challenges_delete_own on public.challenges;
create policy challenges_delete_own on public.challenges
  for delete using (creator_user_id = auth.uid());

-- --- challenge_participants ------------------------------------------------
-- You can see the whole leaderboard of a challenge you're in — that is the
-- point of a leaderboard — but you can only write your own row.
drop policy if exists challenge_participants_select on public.challenge_participants;
create policy challenge_participants_select on public.challenge_participants
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.challenge_participants mine
      where mine.challenge_id = challenge_participants.challenge_id
        and mine.user_id = auth.uid()
    )
  );

drop policy if exists challenge_participants_write_own on public.challenge_participants;
create policy challenge_participants_write_own on public.challenge_participants
  for insert with check (user_id = auth.uid());

drop policy if exists challenge_participants_update_own on public.challenge_participants;
create policy challenge_participants_update_own on public.challenge_participants
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists challenge_participants_delete_own on public.challenge_participants;
create policy challenge_participants_delete_own on public.challenge_participants
  for delete using (user_id = auth.uid());
