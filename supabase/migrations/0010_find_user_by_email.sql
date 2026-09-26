-- Friend requests by email (data-model.md §8 addendum).
--
-- Mirrors find_user_by_username (migration 0007): a narrow SECURITY DEFINER
-- RPC that resolves an email address to an id + name for an exact match and
-- nothing else. The email itself lives in auth.users, which client roles
-- cannot read directly (and shouldn't be able to enumerate) — this function
-- is the one sanctioned crossing from a typed email to a real account,
-- scoped to exactly the two columns a friend-request lookup needs.
create or replace function public.find_user_by_email(p_email text)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.name
  from public.users u
  join auth.users au on au.id = u.id
  where lower(au.email) = lower(p_email)
  limit 1;
$$;

revoke all on function public.find_user_by_email(text) from public, anon;
grant execute on function public.find_user_by_email(text) to authenticated;
