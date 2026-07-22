create or replace function tvtime_watch_season(
  p_season_id uuid,
  p_watched boolean default true
)
returns void
language plpgsql
security invoker
set search_path = 'public'
as $$
declare
  v_show_id uuid;
begin
  select show_id into v_show_id from tvtime_seasons where id = p_season_id;

  update tvtime_episodes
  set watched = p_watched,
      watched_at = case when p_watched then now() else null end
  where season_id = p_season_id;

  perform tvtime_update_showstatus(v_show_id, p_watched);
end;
$$;

grant execute on function tvtime_watch_season(uuid, boolean) to authenticated;
revoke execute on function tvtime_watch_season(uuid, boolean) from public, anon;
