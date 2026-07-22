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

  perform tvtime_update_showstatus(v_show_id, p_watched);
end;
$$;

grant execute on function tvtime_watch_episode(uuid, boolean, boolean) to authenticated;
revoke execute on function tvtime_watch_episode(uuid, boolean, boolean) from public, anon;
