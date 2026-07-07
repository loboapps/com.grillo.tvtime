create or replace function tvtime_load_show(p_tmdb_id integer)
returns jsonb
language sql
security invoker
stable
set search_path = 'public'
as $$
  select jsonb_build_object(
    'show_id', s.id,
    'tmdb_id', s.tmdb_id,
    'name', s.name,
    'poster_path', s.poster_path,
    'backdrop_path', s.backdrop_path,
    'user_status', s.user_status,
    'tmdb_status', s.tmdb_status,
    'seasons', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'season_id', se.id,
          'season_number', se.season_number,
          'name', se.name,
          'user_status', se.user_status,
          'episode_count', se.episode_count,
          'watched_count', (
            select count(*) from tvtime_episodes e2
            where e2.season_id = se.id and e2.watched = true
          ),
          'episodes', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'episode_id', ep.id,
                'episode_number', ep.episode_number,
                'name', ep.name,
                'air_date', ep.air_date,
                'watched', ep.watched
              )
              order by ep.episode_number asc
            )
            from tvtime_episodes ep
            where ep.season_id = se.id
          ), '[]'::jsonb)
        )
        order by se.season_number asc
      )
      from tvtime_seasons se
      where se.show_id = s.id
    ), '[]'::jsonb)
  )
  from tvtime_shows s
  where s.tmdb_id = p_tmdb_id;
$$;

grant execute on function tvtime_load_show(integer) to authenticated;
revoke execute on function tvtime_load_show(integer) from public, anon;
