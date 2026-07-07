create or replace function tvtime_sync_show(
  p_tmdb_id integer,
  p_tmdb_status text,
  p_number_of_seasons integer,
  p_number_of_episodes integer,
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
  update tvtime_shows
  set tmdb_status = p_tmdb_status,
      number_of_seasons = p_number_of_seasons,
      number_of_episodes = p_number_of_episodes,
      synced_at = now()
  where tmdb_id = p_tmdb_id
  returning id into v_show_id;

  perform tvtime_update_seasons(v_show_id, p_seasons, p_episodes);
end;
$$;

grant execute on function tvtime_sync_show(integer, text, integer, integer, jsonb, jsonb) to authenticated;
