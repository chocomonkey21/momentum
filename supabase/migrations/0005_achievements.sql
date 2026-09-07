create table if not exists public.user_achievements (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references public.users (id) on delete cascade,
  achievement_type text not null check (achievement_type in (
    'first-step', 'consistent', 'dedicated', 'getting-started', 'committed', 'first-focus'
  )),
  unlocked_at      timestamptz not null default now(),
  constraint user_achievements_unique unique (user_id, achievement_type)
);

create index if not exists user_achievements_user_idx on public.user_achievements (user_id);
alter table public.user_achievements enable row level security;
drop policy if exists user_achievements_all_own on public.user_achievements;
create policy user_achievements_all_own on public.user_achievements
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
