-- The leaderboard policy in 0001 queried challenge_participants from inside
-- challenge_participants' OWN policy, which Postgres rejects at query time with
-- "42P17: infinite recursion detected in policy". Any read of that table failed.
--
-- A SECURITY DEFINER helper breaks the cycle: it runs as the function owner, so
-- RLS is not re-evaluated inside it. It stays safe because it only ever reports
-- on the CALLER's own membership — auth.uid() is resolved per request.
create or replace function public.is_challenge_participant(cid bigint)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.challenge_participants
    where challenge_id = cid and user_id = auth.uid()
  );
$$;

drop policy if exists challenge_participants_select on public.challenge_participants;
create policy challenge_participants_select on public.challenge_participants for select
  using (
    user_id = (select auth.uid())
    or public.is_challenge_participant(challenge_id)
  );

-- Same helper on the challenges policy: referencing challenge_participants
-- directly there would drag its RLS into the evaluation too.
drop policy if exists challenges_select_mine on public.challenges;
create policy challenges_select_mine on public.challenges for select
  using (
    creator_user_id = (select auth.uid())
    or public.is_challenge_participant(id)
  );
