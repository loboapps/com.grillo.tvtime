create or replace function tvtime_add_show(
  p_tmdb_id integer,
  p_name text,
  p_poster_path text,
  p_backdrop_path text,
  p_tmdb_status text,
  p_number_of_seasons integer,
  p_number_of_episodes integer,
  p_user_status text,
  p_seasons jsonb,
  p_episodes jsonb
)
returns void
language plpgsql
security invoker
set search_path = 'public'
as $$
declare
  v_show_id uuid;
begin
  insert into tvtime_shows (
    tmdb_id, name, poster_path, backdrop_path, tmdb_status,
    number_of_seasons, number_of_episodes, user_status, synced_at
  )
  values (
    p_tmdb_id, p_name, p_poster_path, p_backdrop_path, p_tmdb_status,
    p_number_of_seasons, p_number_of_episodes, p_user_status, now()
  )
  on conflict (tmdb_id) do update set
    name = excluded.name,
    poster_path = excluded.poster_path,
    backdrop_path = excluded.backdrop_path,
    tmdb_status = excluded.tmdb_status,
    number_of_seasons = excluded.number_of_seasons,
    number_of_episodes = excluded.number_of_episodes,
    user_status = excluded.user_status,
    synced_at = now()
  returning id into v_show_id;

  perform tvtime_update_seasons(v_show_id, p_seasons, p_episodes);
end;
$$;

grant execute on function tvtime_add_show(integer, text, text, text, text, integer, integer, text, jsonb, jsonb) to authenticated;
