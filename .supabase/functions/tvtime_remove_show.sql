create or replace function tvtime_remove_show(p_show_id uuid)
returns void
language sql
security invoker
set search_path = 'public'
as $$
  delete from tvtime_shows
  where id = p_show_id
    and not exists (
      select 1 from tvtime_episodes
      where show_id = p_show_id and watched = true
    );
$$;

grant execute on function tvtime_remove_show(uuid) to authenticated;
revoke execute on function tvtime_remove_show(uuid) from public, anon;
