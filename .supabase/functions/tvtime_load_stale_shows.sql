create or replace function tvtime_load_stale_shows()
returns jsonb
language sql
security invoker
stable
set search_path = 'public'
as $$
  -- Schedule-driven, not time-driven: a show is only "due" once its own known next episode air
  -- date has actually arrived, regardless of watching/finished/dropped status (a dropped or
  -- finished show can still get a real revival season, announced well in advance per TMDB's
  -- next_episode_to_air). This is normally a tiny result set on any given day, not the whole
  -- library - the whole-library "is there a season TMDB hasn't told us about yet" sweep is a
  -- separate, unconditional check that only the daily cron does (it can't be schedule-gated,
  -- since discovering a brand new season is exactly what sets next_air_date in the first place).
  select coalesce(jsonb_agg(tmdb_id), '[]'::jsonb)
  from tvtime_shows
  where next_air_date is not null
    and next_air_date <= current_date;
$$;

grant execute on function tvtime_load_stale_shows() to authenticated, service_role;
revoke execute on function tvtime_load_stale_shows() from public, anon;
