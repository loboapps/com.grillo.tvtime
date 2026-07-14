create or replace function tvtime_load_tracked_show_ids()
returns jsonb
language sql
security invoker
stable
set search_path = 'public'
as $$
  select coalesce(jsonb_agg(tvmaze_id), '[]'::jsonb) from tvtime_shows;
$$;

grant execute on function tvtime_load_tracked_show_ids() to authenticated;
revoke execute on function tvtime_load_tracked_show_ids() from public, anon;
