create or replace function tvtime_watch_episode(
  p_episode_id uuid,
  p_watched boolean default true
)
returns void
language sql
security invoker
set search_path = 'public'
as $$
  update tvtime_episodes
  set watched = p_watched,
      watched_at = case when p_watched then now() else null end
  where id = p_episode_id;
$$;

grant execute on function tvtime_watch_episode(uuid, boolean) to authenticated;
