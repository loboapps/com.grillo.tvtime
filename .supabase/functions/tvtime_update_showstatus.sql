create or replace function tvtime_update_showstatus(
  p_show_id uuid,
  p_watched boolean
)
returns void
language plpgsql
security invoker
set search_path = 'public'
as $$
declare
  v_remaining integer;
begin
  if p_watched then
    update tvtime_shows set user_status = 'watching'
    where id = p_show_id and user_status = 'dropped';
  end if;

  select count(*) into v_remaining
  from tvtime_episodes e
  join tvtime_seasons s on s.id = e.season_id
  where e.show_id = p_show_id
    and s.season_number != 0
    and e.watched = false;

  if v_remaining = 0 then
    update tvtime_shows set user_status = 'finished'
    where id = p_show_id
      and user_status = 'watching'
      and tvmaze_status = 'Ended';
  else
    update tvtime_shows set user_status = 'watching'
    where id = p_show_id and user_status = 'finished';
  end if;
end;
$$;

grant execute on function tvtime_update_showstatus(uuid, boolean) to authenticated;
revoke execute on function tvtime_update_showstatus(uuid, boolean) from public, anon;
