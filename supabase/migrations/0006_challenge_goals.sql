alter table public.challenges
  add column if not exists goal_value integer not null default 1
  check (goal_value > 0);

drop policy if exists challenge_participants_write_own on public.challenge_participants;
create policy challenge_participants_write_own on public.challenge_participants
  for insert with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.challenges c
      where c.id = challenge_participants.challenge_id and c.creator_user_id = auth.uid()
    )
  );
