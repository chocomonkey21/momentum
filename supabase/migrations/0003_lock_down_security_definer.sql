-- Supabase's security advisor flagged both SECURITY DEFINER functions as
-- reachable over /rest/v1/rpc.
--
-- handle_new_user is a trigger function and should never be callable by a
-- client; triggers fire in the table owner's context and need no EXECUTE grant
-- for the invoking role.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- is_challenge_participant must stay executable by `authenticated`, because RLS
-- policy expressions are evaluated as the calling role and the leaderboard
-- policy depends on it. It discloses nothing the caller can't already see.
revoke all on function public.is_challenge_participant(bigint) from public, anon;
grant execute on function public.is_challenge_participant(bigint) to authenticated;
