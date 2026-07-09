create or replace function tvtime_load_stale_shows()
returns jsonb
language sql
security invoker
stable
set search_path = 'public'
as $$
  -- Syncs every tracked show regardless of status (watching/finished/dropped) - a dropped or
  -- finished show can still get a real revival season years later, and its season/episode data
  -- needs to stay current even while it's excluded from the watch list itself.
  select coalesce(jsonb_agg(tmdb_id), '[]'::jsonb)
  from tvtime_shows
  where synced_at < now() - interval '12 hours';
$$;

grant execute on function tvtime_load_stale_shows() to authenticated;
revoke execute on function tvtime_load_stale_shows() from public, anon;
