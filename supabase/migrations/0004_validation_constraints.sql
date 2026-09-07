-- Keep profile values valid even when a client bypasses the web forms.
-- NOT VALID preserves any legacy rows while enforcing the rule for every new
-- insert or update; existing rows can be audited and cleaned separately.
alter table public.users
  add constraint users_name_length_check
  check (length(btrim(name)) between 1 and 40)
  not valid;

alter table public.users
  add constraint users_username_format_check
  check (
    username is null
    or (
      length(btrim(username)) between 3 and 30
      and username ~ '^[A-Za-z0-9_]+$'
      and username ~ '[A-Za-z]'
    )
  )
  not valid;
