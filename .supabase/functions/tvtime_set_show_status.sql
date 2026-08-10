create or replace function tvtime_set_show_status(p_show_id uuid, p_status text)
returns void
language sql
security invoker
set search_path = 'public'
as $$
  update tvtime_shows set user_status = p_status where id = p_show_id;
$$;

grant execute on function tvtime_set_show_status(uuid, text) to authenticated;
revoke execute on function tvtime_set_show_status(uuid, text) from public, anon;
