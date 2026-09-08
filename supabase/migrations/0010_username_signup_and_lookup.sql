-- Usernames must be assigned at signup and friend lookup must work without
-- exposing the users table through a relaxed RLS policy.
alter table public.users drop constraint if exists users_username_format_check;
alter table public.users
  add constraint users_username_format_check
  check (
    username is null
    or (
      length(btrim(username)) between 3 and 30
      and username ~ '^[A-Za-z0-9_#]+$'
      and username ~ '[A-Za-z]'
    )
  )
  not valid;

-- Backfill legacy accounts only where the existing display name is already a
-- valid handle. Duplicate names are assigned to one deterministic account;
-- the remaining account can choose a handle on a later profile update.
with candidates as (
  select u.id, btrim(coalesce(au.raw_user_meta_data ->> 'username', u.name)) as candidate
  from public.users u
  join auth.users au on au.id = u.id
  where u.username is null
), ranked as (
  select id, candidate,
         row_number() over (partition by lower(candidate) order by id) as rn
  from candidates
  where candidate ~ '^[A-Za-z0-9_#]+$'
    and candidate ~ '[A-Za-z]'
    and length(candidate) between 3 and 30
)
update public.users u
set username = ranked.candidate
from ranked
where u.id = ranked.id
  and ranked.rn = 1
  and not exists (
    select 1 from public.users taken
    where lower(taken.username) = lower(ranked.candidate)
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text := btrim(coalesce(new.raw_user_meta_data ->> 'username', ''));
begin
  insert into public.users (id, name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    case
      when requested_username ~ '^[A-Za-z0-9_#]+$'
        and requested_username ~ '[A-Za-z]'
        and length(requested_username) between 3 and 30
      then requested_username
      else null
    end
  )
  on conflict (id) do nothing;

  insert into public.settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace function public.find_user_by_username(p_username text)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.name
  from public.users u
  where auth.uid() is not null
    and u.username is not null
    and lower(u.username) = lower(btrim(p_username))
    and u.id <> auth.uid()
  limit 1;
$$;

revoke all on function public.find_user_by_username(text) from public, anon;
grant execute on function public.find_user_by_username(text) to authenticated;
