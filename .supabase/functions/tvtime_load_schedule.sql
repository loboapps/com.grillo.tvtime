drop function if exists tvtime_load_schedule();

create or replace function tvtime_load_schedule()
returns jsonb
language sql
security invoker
stable
set search_path = 'public'
as $$
select coalesce(jsonb_agg(
  jsonb_build_object(
    'episode_id', e.id,
    'show_id', sh.id,
    'tvmaze_id', sh.tvmaze_id,
    'name', sh.name,
    'poster_path', sh.poster_path,
    'season_number', s.season_number,
    'episode_number', e.episode_number,
    'episode_name', e.name,
    'air_date', e.air_date,
    'airstamp', e.airstamp
  )
  order by coalesce(e.airstamp, e.air_date::timestamptz), sh.name
), '[]'::jsonb)
from tvtime_episodes e
join tvtime_seasons s on s.id = e.season_id
join tvtime_shows sh on sh.id = e.show_id
where s.season_number != 0
  and e.air_date is not null
  and not e.watched
  and coalesce(e.airstamp > now(), e.air_date >= current_date)
  and sh.user_status != 'dropped';
$$;

grant execute on function tvtime_load_schedule() to authenticated;
revoke execute on function tvtime_load_schedule() from public, anon;
