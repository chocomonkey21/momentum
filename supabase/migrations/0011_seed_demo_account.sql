-- Demo/portfolio seed.
--
-- A free-tier Supabase project pauses after a week idle, and Momentum's decay
-- mechanic backfills every idle day as a miss (-12 each), so a demo account
-- left alone for two weeks opens with every habit at 0. That's the mechanic
-- working correctly; this function exists so a demo account can be reset to a
-- realistic, current history on demand:
--
--   select public.seed_demo_account('<user uuid>');
--
-- It rebuilds ONE user's habits, a year of logs ending today (mood/context/
-- notes, skips, on-time flags), chains, focus sessions, friendships with the
-- seeded friend accounts, two live challenges and achievements. Momentum is
-- replayed with the exact data-model.md §4.1 rules (50 start, +8, -12, skips
-- neutral) so the stored cache matches what the app computes.
--
-- Deterministic (hash-based, no random()), so re-running gives the same data
-- shifted to the new "today". Callable only by the service role / SQL editor.
create or replace function public.seed_demo_account(
  p_user uuid,
  p_today date default (now() at time zone 'Asia/Kolkata')::date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_priya uuid := (select id from users where username = 'priya');
  v_adi   uuid := (select id from users where username = 'adi');
  v_sam   uuid := (select id from users where username = 'sam.w');
  -- name, category, color, difficulty, window_start, deadline, days_old,
  -- base completion %, last-3-weeks completion %
  specs jsonb := '[
    {"n":"Meditate","c":"Mind","col":"green","d":1,"ws":null,"tc":null,"age":364,"base":88,"recent":100},
    {"n":"Morning Run","c":"Fitness","col":"amber","d":3,"ws":"06:00","tc":"09:00","age":364,"base":72,"recent":86},
    {"n":"Read 20 Pages","c":"Study","col":"blue","d":2,"ws":null,"tc":null,"age":364,"base":80,"recent":90},
    {"n":"Journal","c":"Creativity","col":"magenta","d":1,"ws":null,"tc":"23:00","age":300,"base":68,"recent":80},
    {"n":"Cold Shower","c":"Health","col":"vermillion","d":2,"ws":null,"tc":null,"age":24,"base":70,"recent":70}
  ]';
  s jsonb;
  v_hid bigint;
  v_ids bigint[] := '{}';
  d date;
  r int;
  r2 int;
  v_done boolean;
  v_skip boolean;
  v_mood smallint;
  v_ctx context_tag;
  v_note text;
  v_score real;
  lg record;
  v_chain bigint;
  v_ch bigint;
  notes jsonb := '{
    "Meditate":["Ten minutes felt short today.","Busy mind, came back to the breath.","Best session in weeks.","Did it before opening my phone."],
    "Morning Run":["5k in 27 min, new best.","Legs heavy but finished.","Rain run — worth it.","Easy recovery pace."],
    "Read 20 Pages":["Finished Atomic Habits.","Started Deep Work.","Read on the metro.","Kept going past 20."],
    "Journal":["Wrote about the week.","Three good things.","Short entry, tired.","Planned tomorrow."],
    "Cold Shower":["Two minutes, not bad.","Hardest part is starting.","Woke me right up."]
  }';
begin
  if p_user is null or not exists (select 1 from users where id = p_user) then
    raise exception 'seed_demo_account: unknown user %', p_user;
  end if;

  -- Wipe this user's data (only this user's).
  delete from challenge_participants where user_id = p_user
    or challenge_id in (select id from challenges where creator_user_id = p_user);
  delete from challenges where creator_user_id = p_user;
  delete from friendships where user_id = p_user or friend_user_id = p_user;
  delete from user_achievements where user_id = p_user;
  delete from pomodoro_sessions where user_id = p_user;
  delete from chain_habits where chain_id in (select id from habit_chains where user_id = p_user);
  delete from habit_chains where user_id = p_user;
  delete from habit_logs where habit_id in (select id from habits where user_id = p_user);
  delete from habits where user_id = p_user;

  for s in select * from jsonb_array_elements(specs) loop
    insert into habits (user_id, name, frequency, difficulty_level, momentum_score, time_constraint,
                        window_start, category_tag, chart_color, created_at)
    values (p_user, s->>'n', 'daily', (s->>'d')::smallint, 50, s->>'tc', s->>'ws', s->>'c', s->>'col',
            ((p_today - (s->>'age')::int)::timestamp + time '07:00') at time zone 'Asia/Kolkata')
    returning id into v_hid;
    v_ids := v_ids || v_hid;

    for d in select generate_series(p_today - (s->>'age')::int, p_today - 1, interval '1 day')::date loop
      r  := abs(hashtext(s->>'n' || d::text)) % 100;
      r2 := abs(hashtext(d::text || (s->>'n') || 'x')) % 100;
      v_done := r < case when d >= p_today - 21 then (s->>'recent')::int else (s->>'base')::int end;
      v_skip := false;

      -- Scripted beats that make the demo tell a story:
      if s->>'n' = 'Meditate' and d >= p_today - 34 then v_done := true; end if;        -- 34-day streak
      if s->>'n' = 'Cold Shower' and d >= p_today - 3 then v_done := false; end if;      -- 3-day slip → at-risk
      if s->>'n' = 'Cold Shower' and d between p_today - 12 and p_today - 4 then v_done := true; end if;
      if s->>'n' = 'Read 20 Pages' and d = p_today - 5 then v_done := false; v_skip := true; end if; -- planned day off
      if not v_done and not v_skip and r2 > 93
         and not (s->>'n' = 'Cold Shower' and d >= p_today - 3) then v_skip := true; end if;

      v_mood := null; v_ctx := null; v_note := null;
      if v_done then
        v_mood := case when r2 < 8 then 2 when r2 < 30 then 3 when r2 < 70 then 4 else 5 end;
        v_ctx := case s->>'n'
                   when 'Morning Run' then case when r2 % 4 = 0 then 'other' else 'gym' end
                   when 'Read 20 Pages' then case when r2 % 3 = 0 then 'work' else 'home' end
                   when 'Meditate' then case when r2 % 4 = 0 then 'work' when r2 % 9 = 0 then 'other' else 'home' end
                   when 'Journal' then case when r2 % 6 = 0 then 'other' else 'home' end
                   else 'home' end::context_tag;
        if r2 % 11 = 0 then
          v_note := (notes->(s->>'n'))->>(r % jsonb_array_length(notes->(s->>'n')));
        end if;
      elsif v_skip and r2 % 2 = 0 then
        v_mood := 2; v_ctx := 'home';
      end if;

      insert into habit_logs (habit_id, date, completed, skipped, mood_tag, context_tag, notes, on_time, logged_at)
      values (v_hid, d, v_done, v_skip, v_mood, v_ctx, v_note,
              case when v_done and s->>'tc' is not null then r2 < 85 else null end,
              ((d::timestamp + case s->>'n' when 'Morning Run' then time '07:10'
                                           when 'Meditate' then time '06:40'
                                           when 'Cold Shower' then time '07:45'
                                           when 'Read 20 Pages' then time '21:30'
                                           else time '22:15' end
                + make_interval(mins => r2 % 40)) at time zone 'Asia/Kolkata'));
    end loop;

    -- Today: morning habits already done, evening ones still open.
    if s->>'n' in ('Meditate', 'Morning Run') then
      insert into habit_logs (habit_id, date, completed, mood_tag, context_tag, on_time, logged_at)
      values (v_hid, p_today, true, 4, case when s->>'n' = 'Morning Run' then 'gym' else 'home' end::context_tag,
              case when s->>'tc' is not null then true else null end,
              ((p_today::timestamp + time '07:05') at time zone 'Asia/Kolkata'));
    end if;

    -- Replay momentum exactly like replayMomentum().
    v_score := 50;
    for lg in select completed, skipped, date from habit_logs where habit_id = v_hid order by date loop
      if lg.skipped then continue; end if;
      if lg.completed then v_score := least(100, v_score + 8);
      elsif lg.date < p_today then v_score := greatest(0, v_score - 12);
      end if;
    end loop;
    update habits set momentum_score = v_score where id = v_hid;
  end loop;

  -- v_ids order: Meditate, Morning Run, Read, Journal, Cold Shower
  insert into habit_chains (user_id, chain_name, created_at)
  values (p_user, 'Morning Routine', now() - interval '20 days') returning id into v_chain;
  insert into chain_habits (chain_id, habit_id, order_index)
  values (v_chain, v_ids[1], 0), (v_chain, v_ids[2], 1), (v_chain, v_ids[5], 2);
  insert into habit_chains (user_id, chain_name, created_at)
  values (p_user, 'Wind Down', now() - interval '20 days') returning id into v_chain;
  insert into chain_habits (chain_id, habit_id, order_index)
  values (v_chain, v_ids[3], 0), (v_chain, v_ids[4], 1);

  -- Focus sessions: most evenings over the last 5 weeks, plus two today.
  for d in select generate_series(p_today - 35, p_today - 1, interval '1 day')::date loop
    r := abs(hashtext('pomo' || d::text)) % 100;
    continue when r < 30;
    insert into pomodoro_sessions (user_id, habit_id, start_time, end_time, duration_minutes, completed)
    values (p_user, case when r % 3 = 0 then null when r % 2 = 0 then v_ids[3] else v_ids[4] end,
            ((d::timestamp + time '19:00' + make_interval(mins => r)) at time zone 'Asia/Kolkata'),
            ((d::timestamp + time '19:25' + make_interval(mins => r)) at time zone 'Asia/Kolkata'),
            25, r > 8);
    if r > 65 then
      insert into pomodoro_sessions (user_id, habit_id, start_time, end_time, duration_minutes, completed)
      values (p_user, v_ids[3],
              ((d::timestamp + time '20:00') at time zone 'Asia/Kolkata'),
              ((d::timestamp + time '20:25') at time zone 'Asia/Kolkata'), 25, true);
    end if;
  end loop;
  insert into pomodoro_sessions (user_id, habit_id, start_time, end_time, duration_minutes, completed) values
    (p_user, v_ids[3], ((p_today::timestamp + time '09:30') at time zone 'Asia/Kolkata'),
                       ((p_today::timestamp + time '09:55') at time zone 'Asia/Kolkata'), 25, true),
    (p_user, null,     ((p_today::timestamp + time '10:05') at time zone 'Asia/Kolkata'),
                       ((p_today::timestamp + time '10:30') at time zone 'Asia/Kolkata'), 25, true);

  -- Friends: two accepted, one incoming request.
  if v_priya is not null then
    insert into friendships (user_id, friend_user_id, status, created_at) values (p_user, v_priya, 'accepted', now() - interval '40 days');
  end if;
  if v_adi is not null then
    insert into friendships (user_id, friend_user_id, status, created_at) values (p_user, v_adi, 'accepted', now() - interval '32 days');
  end if;
  if v_sam is not null then
    insert into friendships (user_id, friend_user_id, status, created_at) values (v_sam, p_user, 'pending', now() - interval '1 day');
  end if;

  -- Two live challenges.
  insert into challenges (creator_user_id, challenge_name, goal_metric, goal_value, start_date, end_date)
  values (p_user, 'Two-Week Momentum Push', 'Habits completed', 60, p_today - 6, p_today + 7)
  returning id into v_ch;
  insert into challenge_participants (challenge_id, user_id, progress) values (v_ch, p_user, 27);
  if v_priya is not null then insert into challenge_participants values (v_ch, v_priya, 31); end if;
  if v_adi is not null then insert into challenge_participants values (v_ch, v_adi, 19); end if;

  insert into challenges (creator_user_id, challenge_name, goal_metric, goal_value, start_date, end_date)
  values (p_user, 'No-Zero Days', 'Days with at least one habit done', 21, p_today - 12, p_today + 8)
  returning id into v_ch;
  insert into challenge_participants (challenge_id, user_id, progress) values (v_ch, p_user, 13);
  if v_adi is not null then insert into challenge_participants values (v_ch, v_adi, 11); end if;
  if v_sam is not null then insert into challenge_participants values (v_ch, v_sam, 8); end if;

  insert into user_achievements (user_id, achievement_type, unlocked_at) values
    (p_user, 'first-step',      now() - interval '363 days'),
    (p_user, 'getting-started', now() - interval '356 days'),
    (p_user, 'consistent',      now() - interval '340 days'),
    (p_user, 'committed',       now() - interval '330 days'),
    (p_user, 'first-focus',     now() - interval '35 days'),
    (p_user, 'dedicated',       now() - interval '4 days');

  insert into settings (user_id, notifications_enabled, reminder_time)
  values (p_user, true, '08:00')
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.seed_demo_account(uuid, date) from public, anon, authenticated;
