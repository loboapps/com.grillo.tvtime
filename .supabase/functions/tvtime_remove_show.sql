create or replace function tvtime_remove_show(p_show_id uuid)
returns void
language sql
security invoker
set search_path = 'public'
as $$
  delete from tvtime_shows where id = p_show_id;
$$;

grant execute on function tvtime_remove_show(uuid) to authenticated;
revoke execute on function tvtime_remove_show(uuid) from public, anon;
