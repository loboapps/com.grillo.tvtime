create or replace function tvtime_set_season_status(p_season_id uuid, p_status text)
returns void
language sql
security invoker
set search_path = 'public'
as $$
  update tvtime_seasons set user_status = p_status where id = p_season_id;
$$;

grant execute on function tvtime_set_season_status(uuid, text) to authenticated;
revoke execute on function tvtime_set_season_status(uuid, text) from public, anon;
