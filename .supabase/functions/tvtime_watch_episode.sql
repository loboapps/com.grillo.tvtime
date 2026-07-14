create or replace function tvtime_watch_episode(
  p_episode_id uuid,
  p_watched boolean default true,
  p_include_previous boolean default false
)
returns void
language plpgsql
security invoker
set search_path = 'public'
as $$
declare
  v_show_id uuid;
  v_season_number integer;
  v_episode_number integer;
  v_remaining integer;
begin
  select e.show_id into v_show_id from tvtime_episodes e where e.id = p_episode_id;

  if p_include_previous and p_watched then
    select s.season_number, e.episode_number
    into v_season_number, v_episode_number
    from tvtime_episodes e
    join tvtime_seasons s on s.id = e.season_id
    where e.id = p_episode_id;

    update tvtime_episodes e
    set watched = true, watched_at = now()
    from tvtime_seasons s
    where e.season_id = s.id
      and s.show_id = v_show_id
      and e.watched = false
      and (
        s.season_number < v_season_number
        or (s.season_number = v_season_number and e.episode_number <= v_episode_number)
      );
  else
    update tvtime_episodes
    set watched = p_watched,
        watched_at = case when p_watched then now() else null end
    where id = p_episode_id;
  end if;

  -- Marking any episode watched on a dropped show means you're back — un-drop it. There's no
  -- other way to "undrop" today (no UI for it yet), so this is the only path back to watching.
  if p_watched then
    update tvtime_shows set user_status = 'watching' where id = v_show_id and user_status = 'dropped';
  end if;

  -- Keep user_status in sync with whether every non-special episode is now watched.
  -- Specials (season 0) never count toward "finished" since the app doesn't track them.
  -- "Finished" also requires the show itself to have actually ended (tvmaze_status = 'Ended') —
  -- being caught up on a still-airing show isn't "finished", it just means there's nothing to
  -- watch *yet*, which is a different state (no next_ep, but the show stays 'watching' so it
  -- correctly flips back to showing up once a new episode is synced in). Positive check, not an
  -- exclusion list: a full sweep of TVmaze's catalog (88,627 shows, zero errors) found exactly 4
  -- status values ever used — Running, Ended, To Be Determined, In Development — and confirmed
  -- cancelled shows (Firefly, Brooklyn Nine-Nine, The OA) report 'Ended' too, same as naturally
  -- concluded ones. So 'Ended' alone covers both cases; no exclusion list to keep in sync.
  select count(*) into v_remaining
  from tvtime_episodes e
  join tvtime_seasons s on s.id = e.season_id
  where e.show_id = v_show_id and s.season_number != 0 and e.watched = false;

  if v_remaining = 0 then
    update tvtime_shows
    set user_status = 'finished'
    where id = v_show_id
      and user_status = 'watching'
      and tvmaze_status = 'Ended';
  else
    update tvtime_shows set user_status = 'watching' where id = v_show_id and user_status = 'finished';
  end if;
end;
$$;

grant execute on function tvtime_watch_episode(uuid, boolean, boolean) to authenticated;
revoke execute on function tvtime_watch_episode(uuid, boolean, boolean) from public, anon;
