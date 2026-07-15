-- Adding a trailing defaulted param still changes the signature identity, so CREATE OR REPLACE
-- would leave the old version as a separate overload instead of replacing it (learned the
-- hard way earlier on tvtime_load_watchlist) — drop it explicitly first.
drop function if exists tvtime_add_show(integer, text, text, text, text, text, integer, integer, text, jsonb, jsonb, date);

create or replace function tvtime_add_show(
  p_tvmaze_id integer,
  p_name text,
  p_original_name text,
  p_poster_path text,
  p_backdrop_path text,
  p_tvmaze_status text,
  p_imdb_id text,
  p_number_of_seasons integer,
  p_number_of_episodes integer,
  p_user_status text,
  p_seasons jsonb,
  p_episodes jsonb,
  p_next_air_date date default null
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
    tvmaze_id, name, original_name, poster_path, backdrop_path, tvmaze_status, imdb_id,
    number_of_seasons, number_of_episodes, user_status, next_air_date, synced_at
  )
  values (
    p_tvmaze_id, p_name, p_original_name, p_poster_path, p_backdrop_path, p_tvmaze_status, p_imdb_id,
    p_number_of_seasons, p_number_of_episodes, p_user_status, p_next_air_date, now()
  )
  on conflict (tvmaze_id) do update set
    name = excluded.name,
    original_name = excluded.original_name,
    poster_path = excluded.poster_path,
    backdrop_path = excluded.backdrop_path,
    tvmaze_status = excluded.tvmaze_status,
    imdb_id = excluded.imdb_id,
    number_of_seasons = excluded.number_of_seasons,
    number_of_episodes = excluded.number_of_episodes,
    user_status = excluded.user_status,
    next_air_date = excluded.next_air_date,
    synced_at = now()
  returning id into v_show_id;

  perform tvtime_update_seasons(v_show_id, p_seasons, p_episodes);
end;
$$;

grant execute on function tvtime_add_show(integer, text, text, text, text, text, text, integer, integer, text, jsonb, jsonb, date) to authenticated, service_role;
revoke execute on function tvtime_add_show(integer, text, text, text, text, text, text, integer, integer, text, jsonb, jsonb, date) from public, anon;
