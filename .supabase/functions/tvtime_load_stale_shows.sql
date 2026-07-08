create or replace function tvtime_load_stale_shows()
returns jsonb
language sql
security invoker
stable
set search_path = 'public'
as $$
  select coalesce(jsonb_agg(tmdb_id), '[]'::jsonb)
  from tvtime_shows
  where user_status != 'dropped'
    and synced_at < now() - interval '12 hours';
$$;

grant execute on function tvtime_load_stale_shows() to authenticated;
revoke execute on function tvtime_load_stale_shows() from public, anon;
