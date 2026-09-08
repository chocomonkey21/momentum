-- Friend requests by username were reporting "no account found" for every
-- real username: RLS only lets a caller read their OWN row in `users`, so
-- the client-side lookup in requestFriendByUsername() always came back
-- empty, even for a valid account. This closes that gap the same way
-- 0002 fixed the challenge leaderboard — a narrow SECURITY DEFINER
-- function, not a relaxed policy on the whole table.
--
-- It returns only id + name, for an exact (case-insensitive) username
-- match, and nothing else about the account — no email, no habits, no
-- friendship state. That's the full surface a friend-request lookup needs.
create or replace function public.find_user_by_username(p_username text)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.name
  from public.users u
  where u.username is not null
    and lower(u.username) = lower(p_username)
  limit 1;
$$;

revoke all on function public.find_user_by_username(text) from public, anon;
grant execute on function public.find_user_by_username(text) to authenticated;
