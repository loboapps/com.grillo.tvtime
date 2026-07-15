-- Same signature-identity note as tvtime_add_show: a trailing defaulted param still needs the
-- old overload dropped first, or it just adds a second function instead of replacing this one.
drop function if exists tvtime_sync_show(integer, text, text, integer, integer, jsonb, jsonb, date);

create or replace function tvtime_sync_show(
  p_tvmaze_id integer,
  p_tvmaze_status text,
  p_imdb_id text,
  p_original_name text,
  p_number_of_seasons integer,
  p_number_of_episodes integer,
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
  update tvtime_shows
  set tvmaze_status = p_tvmaze_status,
      imdb_id = p_imdb_id,
      original_name = p_original_name,
      number_of_seasons = p_number_of_seasons,
      number_of_episodes = p_number_of_episodes,
      next_air_date = p_next_air_date,
      synced_at = now()
  where tvmaze_id = p_tvmaze_id
  returning id into v_show_id;

  perform tvtime_update_seasons(v_show_id, p_seasons, p_episodes);
end;
$$;

grant execute on function tvtime_sync_show(integer, text, text, text, integer, integer, jsonb, jsonb, date) to authenticated, service_role;
revoke execute on function tvtime_sync_show(integer, text, text, text, integer, integer, jsonb, jsonb, date) from public, anon;
